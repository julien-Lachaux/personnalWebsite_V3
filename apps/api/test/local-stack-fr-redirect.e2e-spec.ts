import { existsSync, readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Garde de la redirection /fr contre la pile locale complète (BF-14) : vraies requêtes HTTP, sans suivre
 * les redirections, vers Caddy (RE2 et décodage du chemin par Caddy, que les RegExp JavaScript de
 * `fr-redirect.e2e-spec.ts` ne reproduisent pas). Mêmes règles de disponibilité que local-stack : sans
 * pile, un test unique le consigne ; avec STACK_REQUIRED=1 (CI), l'absence de la pile fait échouer.
 * Le nom contient `local-stack` : le job pile-locale (`vitest run --project e2e local-stack`) le lance.
 */

const envFile =
  process.env['STACK_ENV_FILE'] ??
  fileURLToPath(new URL('../../../docker/.env.local', import.meta.url));
const stackRequired = process.env['STACK_REQUIRED'] === '1';

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

const httpsPort = Number(readEnvFile()['HTTPS_PORT'] ?? '8443');

interface Reply {
  status: number;
  location: string | undefined;
}

/** GET brut vers Caddy (chemin envoyé tel quel, redirections non suivies, certificat interne accepté). */
function get(path: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      {
        host: 'localhost',
        port: httpsPort,
        path,
        method: 'GET',
        rejectUnauthorized: false,
        agent: false,
        timeout: 5000,
      },
      (response) => {
        response.resume();
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, location: response.headers.location }),
        );
      },
    );
    request.on('timeout', () => request.destroy(new Error('délai dépassé')));
    request.on('error', reject);
    request.end();
  });
}

async function stackIsAvailable(): Promise<boolean> {
  if (!existsSync(envFile)) {
    return false;
  }
  try {
    // 429 : la pile tourne, mais le quota de l'API est épuisé par un autre essai.
    const status = (await get('/api/v1/health')).status;
    return status === 200 || status === 429;
  } catch {
    return false;
  }
}

const available = await stackIsAvailable();

if (!available) {
  describe('redirection /fr sur la pile locale (absente)', () => {
    it(
      stackRequired
        ? 'la pile locale est attendue (STACK_REQUIRED=1) mais ne répond pas : lancer `pnpm stack:up`'
        : 'pile locale non démarrée : garde de /fr non rejouée (`pnpm stack:up` pour la jouer)',
      () => {
        expect(stackRequired, `pile injoignable via ${envFile} sur le port ${httpsPort}`).toBe(
          false,
        );
      },
    );
  });
} else {
  describe('redirection /fr sur la pile locale : requêtes HTTP réelles', () => {
    it.each([
      '/fr/%09/hote.test',
      '/fr/%0d/hote.test',
      '/fr/%0a/hote.test',
      '/fr/%20/hote.test',
      '/fr/%2F/hote.test',
      '/fr/%5C/hote.test',
      '/fr/%252F/hote.test',
      '/fr//hote.test',
      '/fr/a%09b',
    ])('%s : 404 et aucun en-tête Location', async (path) => {
      const reply = await get(path);

      expect(reply.status).toBe(404);
      expect(reply.location).toBeUndefined();
    });

    it.each([
      ['/fr', '/'],
      ['/fr/a/b', '/a/b'],
      ['/fr/cv/cv-fr.pdf', '/cv/cv-fr.pdf'],
    ])('%s : 301 vers %s', async (path, target) => {
      const reply = await get(path);

      expect(reply.status).toBe(301);
      expect(reply.location).toBe(target);
    });
  });
}
