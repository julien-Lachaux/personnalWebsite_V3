import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Parcours de fumée du front servi par la pile locale complète (BF-15) : `pnpm stack:up` génère le front
 * contre l'API migrée et seedée, Caddy le sert. Mêmes règles de disponibilité que local-stack : sans pile,
 * un test unique le consigne ; avec STACK_REQUIRED=1 (CI), l'absence de la pile fait échouer.
 * La CSP est vérifiée dans un vrai navigateur (service docker `playwright`, `pnpm e2e:browsers:up`) par
 * scripts/deploy/csp-smoke.mjs : aucune violation, script de thème exécuté sous la politique.
 */

const envFile =
  process.env['STACK_ENV_FILE'] ??
  fileURLToPath(new URL('../../../docker/.env.local', import.meta.url));
const smokeScript = fileURLToPath(
  new URL('../../../scripts/deploy/csp-smoke.mjs', import.meta.url),
);
const themeScript = fileURLToPath(
  new URL('../../../apps/web/app/domain/theme-script.ts', import.meta.url),
);
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

const env = readEnvFile();
const httpsPort = Number(env['HTTPS_PORT'] ?? '8443');
const browserPort = Number(process.env['PLAYWRIGHT_PORT'] ?? '3100');

interface StackResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

/** GET HTTPS brut vers Caddy : le chemin est envoyé tel quel (HTTP/1.1, certificat interne accepté). */
function get(path: string): Promise<StackResponse> {
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
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    request.on('timeout', () => request.destroy(new Error('délai dépassé')));
    request.on('error', reject);
    request.end();
  });
}

const text = (response: StackResponse) => response.body.toString('utf8');
const header = (response: StackResponse, name: string) => {
  const value = response.headers[name];
  return Array.isArray(value) ? value.join(', ') : (value ?? '');
};

function browsersReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port: browserPort, timeout: 2000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
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
const browsers = available && (await browsersReachable());

if (!available) {
  describe('front servi par la pile locale (absente)', () => {
    it(
      stackRequired
        ? 'la pile locale est attendue (STACK_REQUIRED=1) mais ne répond pas : lancer `pnpm stack:up`'
        : 'pile locale non démarrée : parcours de fumée du front non rejoué (`pnpm stack:up` pour le jouer)',
      () => {
        expect(stackRequired, `pile injoignable via ${envFile} sur le port ${httpsPort}`).toBe(
          false,
        );
      },
    );
  });
} else {
  describe('front servi par la pile locale : parcours de fumée', () => {
    it('/ et /en : 200 HTML avec le vrai contenu de l’API (firstName et lastName du profil)', async () => {
      const profile = JSON.parse(text(await get('/api/v1/profile?lang=fr'))) as {
        firstName: string;
        lastName: string;
      };

      const home = await get('/');
      const english = await get('/en');

      expect(home.status).toBe(200);
      expect(header(home, 'content-type')).toContain('text/html');
      expect(text(home)).toContain('<main id="contenu"');
      expect(text(home)).toContain(profile.firstName);
      expect(text(home)).toContain(profile.lastName);
      expect(text(home)).toMatch(/<html[^>]*\blang="fr"/);
      expect(english.status).toBe(200);
      expect(text(english)).toContain('<main id="contenu"');
      expect(text(english)).toMatch(/<html[^>]*\blang="en"/);
      expect(text(english)).toContain(profile.firstName);
    });

    it.each([
      ['/fr', '/'],
      ['/fr/', '/'],
      ['/fr/accessibilite', '/accessibilite'],
    ])('%s : redirection permanente 301 vers %s', async (path, target) => {
      const response = await get(path);

      expect(response.status).toBe(301);
      expect(header(response, 'location')).toBe(target);
    });

    it('/fr//hote.test : jamais une redirection vers un autre site', async () => {
      const response = await get('/fr//hote.test');

      expect(response.status).toBe(404);
      expect(header(response, 'location')).toBe('');
    });

    it('route inconnue : 404 avec la page 404 du front (et sa CSP), jamais un texte brut', async () => {
      const response = await get('/route-inconnue');

      expect(response.status).toBe(404);
      expect(header(response, 'content-type')).toContain('text/html');
      expect(text(response)).toContain('<div id="__nuxt">');
      expect(header(response, 'content-security-policy')).toContain("default-src 'self'");
      expect(response.headers['server']).toBeUndefined();
    });

    it('/cv/cv-fr.pdf : 200 application/pdf, à revalider', async () => {
      const response = await get('/cv/cv-fr.pdf');

      expect(response.status).toBe(200);
      expect(header(response, 'content-type')).toBe('application/pdf');
      expect(response.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(header(response, 'cache-control')).toBe('no-cache');
    });

    it('en-têtes de sécurité du front, sans doublon ni Server', async () => {
      const response = await get('/');

      expect(header(response, 'strict-transport-security')).toContain('max-age=');
      expect(header(response, 'x-content-type-options')).toBe('nosniff');
      expect(header(response, 'referrer-policy')).toBe('no-referrer');
      expect(header(response, 'permissions-policy')).toContain('camera=()');
      expect(header(response, 'x-frame-options')).toBe('DENY');
      expect(header(response, 'cache-control')).toBe('no-cache');
      expect(response.headers['server']).toBeUndefined();
    });

    it('CSP stricte : aucun domaine tiers, ni unsafe-inline ni unsafe-eval', async () => {
      const csp = header(await get('/'), 'content-security-policy');

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).not.toContain('unsafe-');
      expect(csp).not.toMatch(/https?:\/\//);
    });

    it('la CSP autorise l’empreinte du script de thème (THEME_SCRIPT_SHA256) et chaque script en ligne servi', async () => {
      const themeHash = /THEME_SCRIPT_SHA256\s*=\s*'(sha256-[A-Za-z0-9+/=]+)'/.exec(
        readFileSync(themeScript, 'utf8'),
      )?.[1];
      const pages = ['/', '/en', '/accessibilite', '/en/accessibility', '/route-inconnue'];

      for (const path of pages) {
        const response = await get(path);
        const csp = header(response, 'content-security-policy');
        const scriptSrc = /script-src ([^;]*)/.exec(csp)?.[1] ?? '';

        expect(scriptSrc, path).toContain(`'${themeHash}'`);
        const inlineScripts = [...text(response).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
          .filter(([, attributes]) => !/\bsrc=|type="application\/json"/.test(attributes ?? ''))
          .map(([, , content]) => content ?? '');
        expect(inlineScripts.length, path).toBeGreaterThan(0);
        for (const content of inlineScripts) {
          const hash = createHash('sha256').update(content, 'utf8').digest('base64');
          expect(scriptSrc, `${path} : script en ligne sans empreinte`).toContain(
            `'sha256-${hash}'`,
          );
        }
      }
    });

    it('cache : fichiers à empreinte immutables, pages et polices distinguées', async () => {
      const home = text(await get('/'));
      const asset = /\/_nuxt\/[\w.-]+\.js/.exec(home)?.[0] ?? '';
      const font = /\/fonts\/[\w./-]+\.woff2/.exec(home)?.[0];

      expect(asset).not.toBe('');
      const immutable = await get(asset);
      expect(immutable.status).toBe(200);
      expect(header(immutable, 'cache-control')).toBe('public, max-age=31536000, immutable');
      if (font !== undefined) {
        expect(header(await get(font), 'cache-control')).toBe('public, max-age=604800');
      }
    });

    it('le fichier csp.caddy n’est pas servi (hors du dossier public)', async () => {
      expect((await get('/csp.caddy')).status).toBe(404);
    });

    if (browsers) {
      it('navigateur : aucune violation CSP, script de thème exécuté, pages affichées', () => {
        const result = spawnSync(
          'node',
          [smokeScript, `https://localhost:${httpsPort}`, `ws://127.0.0.1:${browserPort}/`],
          { encoding: 'utf8', timeout: 150_000 },
        );

        expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      }, 180_000);
    } else {
      it(
        stackRequired
          ? 'navigateurs attendus (STACK_REQUIRED=1) mais injoignables : lancer `pnpm e2e:browsers:up`'
          : 'navigateurs non démarrés : violations CSP non vérifiées (`pnpm e2e:browsers:up`)',
        () => {
          expect(stackRequired, `serveur de navigateurs injoignable sur ${browserPort}`).toBe(
            false,
          );
        },
      );
    }
  });
}
