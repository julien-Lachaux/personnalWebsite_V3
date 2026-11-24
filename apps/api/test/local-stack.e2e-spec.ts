import { existsSync, readFileSync } from 'node:fs';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { runCompose } from './support/compose.js';

/**
 * Scénarios de reproduction de la production, rejoués contre la pile locale complète
 * (`pnpm stack:up` : compose.prod.yml, Caddyfile et image identiques à la production).
 *
 * Détection explicite : la pile est « disponible » si docker/.env.local (ou STACK_ENV_FILE) existe et si
 * /api/v1/health répond via Caddy. Sinon, sur un poste sans pile, un test unique le consigne et réussit ;
 * avec STACK_REQUIRED=1 (CI), l'absence de la pile fait échouer ce test.
 */

const composeFile = fileURLToPath(new URL('../../../docker/compose.prod.yml', import.meta.url));
const envFile =
  process.env['STACK_ENV_FILE'] ??
  fileURLToPath(new URL('../../../docker/.env.local', import.meta.url));
const stackRequired = process.env['STACK_REQUIRED'] === '1';

interface StackResponse {
  status: number;
  headers: IncomingMessage['headers'];
  /** Valeurs brutes des en-têtes (un nom répété apparaît autant de fois que reçu). */
  rawHeaders: string[];
  body: string;
}

function readEnvFile(): Record<string, string> {
  if (!existsSync(envFile)) {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match?.[1] !== undefined) {
      values[match[1]] = match[2] ?? '';
    }
  }
  return values;
}

const env = readEnvFile();
const httpsPort = Number(env['HTTPS_PORT'] ?? '8443');
const httpPort = Number(env['HTTP_PORT'] ?? '8080');
const rateLimitMax = Number(env['RATE_LIMIT_MAX'] ?? '100');

/** Requête HTTP(S) brute vers Caddy (HTTP/1.1, certificat interne accepté, chemin envoyé tel quel). */
function send(
  path: string,
  options: { method?: string; body?: string; tls?: boolean } = {},
): Promise<StackResponse> {
  const tls = options.tls ?? true;
  const makeRequest = tls ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const request = makeRequest(
      {
        host: 'localhost',
        port: tls ? httpsPort : httpPort,
        path,
        method: options.method ?? 'GET',
        rejectUnauthorized: false,
        agent: false,
        timeout: 5000,
        headers:
          options.body === undefined ? {} : { 'content-length': Buffer.byteLength(options.body) },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            rawHeaders: response.rawHeaders,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('timeout', () => request.destroy(new Error('délai dépassé')));
    request.on('error', reject);
    request.end(options.body);
  });
}

/** Nombre de fois où l'en-tête figure dans la réponse (un doublon serait un défaut). */
function countHeader(response: StackResponse, name: string): number {
  return response.rawHeaders.filter(
    (value, index) => index % 2 === 0 && value.toLowerCase() === name,
  ).length;
}

function compose(args: string[]) {
  // `-p` prime sur la COMPOSE_PROJECT_NAME du `.env` racine que vitest.e2e charge dans l'environnement.
  const project = env['COMPOSE_PROJECT_NAME'] ? ['-p', env['COMPOSE_PROJECT_NAME']] : [];
  return runCompose([...project, '-f', composeFile, '--env-file', envFile, ...args], {
    encoding: 'utf8',
  });
}

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = 'aucune réponse';
  while (Date.now() < deadline) {
    try {
      const response = await send('/api/v1/health');
      if (response.status === 200) {
        return;
      }
      last = `statut ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`la pile ne répond pas : ${last}`);
}

async function stackIsAvailable(): Promise<boolean> {
  if (!existsSync(envFile)) {
    return false;
  }
  try {
    const response = await send('/api/v1/health');
    // 429 : la pile tourne, mais son quota est épuisé par un essai précédent (beforeAll attend la fin de la fenêtre).
    return response.status === 200 || response.status === 429;
  } catch {
    return false;
  }
}

const available = await stackIsAvailable();

if (!available) {
  describe('pile locale complète (absente)', () => {
    it(
      stackRequired
        ? 'la pile locale est attendue (STACK_REQUIRED=1) mais ne répond pas : lancer `pnpm stack:up`'
        : 'pile locale non démarrée : scénarios de reproduction non rejoués (`pnpm stack:up` pour les jouer)',
      () => {
        expect(stackRequired, `pile injoignable via ${envFile} sur le port ${httpsPort}`).toBe(
          false,
        );
      },
    );
  });
} else {
  describe('pile locale complète : scénarios de reproduction de la production', () => {
    beforeAll(async () => {
      // Le quota par IP est celui de la pile : attendre qu'un essai précédent n'ait pas laissé 429.
      await waitForHealth(70_000);
    }, 90_000);

    it('GET /api/v1/profile : 200, en-têtes de sécurité uniques, ni Server ni Via', async () => {
      const response = await send('/api/v1/profile');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(countHeader(response, 'x-frame-options')).toBe(1);
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(countHeader(response, 'content-security-policy')).toBe(1);
      expect(response.headers['content-security-policy']).toBe(
        "default-src 'none';frame-ancestors 'none'",
      );
      expect(response.headers['strict-transport-security']).toContain('max-age=');
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers.via).toBeUndefined();
    });

    it('POST sur une route existante : 405 problem+json avec Allow (réponse de l’API)', async () => {
      const response = await send('/api/v1/profile', { method: 'POST', body: '{}' });

      expect(response.status).toBe(405);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.headers.allow).toBe('GET, HEAD, OPTIONS');
      expect(response.headers['server']).toBeUndefined();
    });

    it('corps de 2 Kio : 413 text/plain produit par Caddy (écart connu)', async () => {
      const response = await send('/api/v1/profile', { method: 'POST', body: 'a'.repeat(2048) });

      expect(response.status).toBe(413);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.headers['server']).toBeUndefined();
    });

    it('route inconnue : 404 problem+json', async () => {
      const response = await send('/api/v1/inconnue');

      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });

    it('URL mal encodée : 400 text/plain produit par Caddy (écart connu)', async () => {
      const response = await send('/api/%zz');

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.headers['server']).toBeUndefined();
    });

    it('HTTP : redirection permanente (301) vers HTTPS sur le port publié, sans Server', async () => {
      const response = await send('/api/v1/profile?a=1', { tls: false });

      expect(response.status).toBe(301);
      expect(response.headers.location).toBe(`https://localhost:${httpsPort}/api/v1/profile?a=1`);
      expect(response.headers['server']).toBeUndefined();
    });

    it('PostgreSQL : le rôle de l’API ne peut que lire', () => {
      const psql = (sql: string) =>
        compose([
          'exec',
          '-T',
          'postgres',
          'psql',
          '-U',
          'siteperso_api',
          '-d',
          'siteperso',
          '-tAc',
          sql,
        ]);

      const read = psql('select current_user');
      expect(read.status, read.stderr).toBe(0);
      expect(read.stdout.trim()).toBe('siteperso_api');

      const write = psql('create table essai_ecriture (id int)');
      expect(write.status).not.toBe(0);
      expect(write.stderr).toContain('permission denied');

      const superuser = psql("select rolsuper from pg_roles where rolname = 'siteperso_api'");
      expect(superuser.stdout.trim()).toBe('f');
    });

    it('réseaux internes : Caddy ne joint pas la base, l’API ne sort pas sur Internet', () => {
      const caddyToDatabase = compose([
        'exec',
        '-T',
        'caddy',
        'nc',
        '-z',
        '-w',
        '3',
        'postgres',
        '5432',
      ]);
      expect(caddyToDatabase.status).not.toBe(0);

      const apiToInternet = compose([
        'exec',
        '-T',
        'api',
        'node',
        '-e',
        "require('node:net').connect({host:'1.1.1.1',port:443,timeout:3000}).on('connect',()=>process.exit(0)).on('error',()=>process.exit(1)).on('timeout',()=>process.exit(1))",
      ]);
      expect(apiToInternet.status).toBe(1);
    });

    it('quota dépassé : 429 problem+json (le quota par IP est celui de la pile)', async () => {
      let last = await send('/api/v1/health');
      for (let sent = 1; last.status !== 429 && sent <= rateLimitMax + 10; sent += 1) {
        last = await send('/api/v1/health');
      }

      expect(last.status).toBe(429);
      expect(last.headers['content-type']).toContain('application/problem+json');
      expect(last.headers['retry-after']).toBeDefined();
    }, 60_000);

    it('API arrêtée : 502 text/plain produit par Caddy (écart connu), sans Server', async () => {
      expect(compose(['stop', 'api']).status).toBe(0);
      try {
        const response = await send('/api/v1/profile');

        expect(response.status).toBe(502);
        expect(response.headers['content-type']).toContain('text/plain');
        expect(response.headers['server']).toBeUndefined();
      } finally {
        // Le redémarrage de l'API remet aussi son quota à zéro : la pile est rendue propre.
        compose(['start', 'api']);
        await waitForHealth(60_000);
      }
    }, 120_000);
  });
}
