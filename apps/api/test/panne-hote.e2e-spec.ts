import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Pile arrêtée vue par le Caddy de l'HÔTE (D48, lot 35), rejouée contre le VRAI bloc d'erreurs de l'hôte
 * (docker/host-errors.caddy, source unique reportée sur le serveur) dans un conteneur Caddy seul : le socket
 * Unix de la pile n'existe pas (502), copie factice des pages de secours montée sur /srv/site-perso-errors.
 * Routes d'essai : des erreurs 500, 503 et 504 produites par l'hôte, et un amont factice (second site du même
 * Caddy) qui répond lui-même un 500 problem+json, pour prouver qu'il traverse reverse_proxy inchangé.
 * La preuve sur la pile d'essai complète (frontal -> socket -> pile) est dans panne-vps-stack.e2e-spec.ts.
 */
const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const engineResult = spawnSync(
  'bash',
  ['-c', `source ${root('scripts/container-engine.sh')} && container_engine`],
  { encoding: 'utf8' },
);
const engine = engineResult.status === 0 ? engineResult.stdout.trim() : '';
const image = /image: (docker\.io\/library\/caddy:\S+)/.exec(
  readFileSync(root('docker/compose.vps-frontal.yml'), 'utf8'),
)?.[1];

const DETAIL = 'Le service est momentanément indisponible. Réessayez dans quelques instants.';
const UPSTREAM_BODY =
  '{"type":"about:blank","title":"Erreur interne","status":500,"detail":"Erreur de l’API elle-même."}';
const CSP = "default-src 'self'; script-src 'self' 'sha256-AAAA'";

const dir = mkdtempSync(join(tmpdir(), 'siteperso-panne-hote-'));
const copies = ['50x.html', 'en/50x.html', '_nuxt/a.css', 'fonts/f.woff2'];
mkdirSync(join(dir, 'errors'), { recursive: true });
for (const copy of copies) {
  mkdirSync(dirname(join(dir, 'errors', copy)), { recursive: true });
  writeFileSync(join(dir, 'errors', copy), `COPIE ${copy}\n`);
}
// Valeur seule de la CSP, une ligne sans saut de ligne final (comme la copie du déploiement).
writeFileSync(join(dir, 'errors/csp.txt'), CSP);
writeFileSync(
  join(dir, 'Caddyfile'),
  [
    '{\n\tadmin off\n\tauto_https off\n}',
    'http://:80 {',
    '\thandle /boom/* {\n\t\terror 500\n\t}',
    '\thandle /en/boom/* {\n\t\terror 503\n\t}',
    '\thandle /api/boom/504 {\n\t\terror 504\n\t}',
    '\thandle /api/amont/* {\n\t\trewrite * /\n\t\treverse_proxy 127.0.0.1:9000\n\t}',
    '\treverse_proxy unix//run/prod/absent.sock',
    '\timport /etc/caddy/host-errors.caddy',
    '}',
    `http://:9000 {\n\theader Content-Type "application/problem+json"\n\trespond \`${UPSTREAM_BODY}\` 500\n}\n`,
  ].join('\n'),
);
for (const sub of ['', 'errors', 'errors/_nuxt', 'errors/fonts', 'errors/en']) {
  chmodSync(join(dir, sub), 0o755);
}
for (const file of ['Caddyfile', 'errors/csp.txt', ...copies.map((copy) => `errors/${copy}`)]) {
  chmodSync(join(dir, file), 0o644);
}

interface Running {
  base: string;
  name: string;
}

function engineRun(args: string[]) {
  return spawnSync(engine, args, { encoding: 'utf8' });
}

function start(): Running {
  const name = `siteperso-panne-hote-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const created = engineRun([
    'run',
    '-d',
    '--name',
    name,
    '-p',
    '127.0.0.1::80',
    '--security-opt',
    'label=disable',
    '--tmpfs',
    '/tmp',
    '-v',
    `${join(dir, 'Caddyfile')}:/etc/caddy/Caddyfile:ro`,
    '-v',
    `${root('docker/host-errors.caddy')}:/etc/caddy/host-errors.caddy:ro`,
    '-v',
    `${join(dir, 'errors')}:/srv/site-perso-errors:ro`,
    image ?? '',
  ]);
  expect(created.status, created.stderr).toBe(0);
  const port = /:(\d+)\s*$/m.exec(engineRun(['port', name, '80/tcp']).stdout)?.[1];
  return { base: `http://127.0.0.1:${port}`, name };
}

async function get(running: Running, path: string, init?: RequestInit) {
  const response = await fetch(`${running.base}${path}`, { redirect: 'manual', ...init });
  return { response, body: await response.text() };
}

async function waitReady(running: Running) {
  for (let i = 0; i < 50; i += 1) {
    try {
      await fetch(running.base, { redirect: 'manual' });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error('Caddy ne répond pas');
}

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

if (engine === '' || !image) {
  describe('pile arrêtée, Caddy de l’hôte (moteur de conteneurs absent)', () => {
    it('moteur de conteneurs introuvable : scénarios non rejoués', () => {
      expect(process.env['CI'], 'moteur de conteneurs attendu en CI').toBeUndefined();
    });
  });
} else {
  describe('pile arrêtée, Caddy de l’hôte (D48)', () => {
    let running: Running;
    beforeAll(async () => {
      running = start();
      await waitReady(running);
    }, 60_000);
    afterAll(() => {
      engineRun(['rm', '-f', running.name]);
    });

    it('/api/* : 502 problem+json minimal, mêmes en-têtes que la pile, jamais la page HTML', async () => {
      const { response, body } = await get(running, '/api/v1/profile');

      expect(response.status).toBe(502);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
      expect(body).toBe(
        `{"type":"about:blank","title":"Bad Gateway","status":502,"detail":"${DETAIL}"}`,
      );
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('retry-after')).toBe('30');
      expect(response.headers.get('content-security-policy')).toBe(
        "default-src 'none';frame-ancestors 'none'",
      );
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('server')).toBeNull();
    });

    it('/api/* : 504 de l’hôte, même gabarit au statut d’origine', async () => {
      const { response, body } = await get(running, '/api/boom/504');

      expect(response.status).toBe(504);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
      expect(body).toBe(
        `{"type":"about:blank","title":"Gateway Timeout","status":504,"detail":"${DETAIL}"}`,
      );
    });

    it('erreur 500 produite par l’API elle-même : transmise inchangée', async () => {
      const { response, body } = await get(running, '/api/amont/x');

      expect(response.status).toBe(500);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
      expect(body).toBe(UPSTREAM_BODY);
      expect(response.headers.get('retry-after')).toBeNull();
    });

    it('pages : 50x du front, français ou anglais, avec le statut de l’erreur, la CSP copiée et no-cache', async () => {
      for (const [path, status, page] of [
        ['/', 502, '50x.html'],
        ['/accessibilite', 502, '50x.html'],
        ['/en', 502, 'en/50x.html'],
        ['/en/accessibility', 502, 'en/50x.html'],
        ['/boom/x', 500, '50x.html'],
        ['/en/boom/x', 503, 'en/50x.html'],
      ] as const) {
        const { response, body } = await get(running, path);

        expect(response.status, path).toBe(status);
        expect(body, path).toBe(`COPIE ${page}\n`);
        expect(response.headers.get('content-type'), path).toContain('text/html');
        expect(response.headers.get('content-security-policy'), path).toBe(CSP);
        expect(response.headers.get('cache-control'), path).toBe('no-cache');
        expect(response.headers.get('x-robots-tag'), path).toBe('noindex');
        expect(response.headers.get('server'), path).toBeNull();
      }
    });

    it('ressources de la copie (/_nuxt/*, /fonts/*) servies en 200', async () => {
      for (const [path, content] of [
        ['/_nuxt/a.css', 'COPIE _nuxt/a.css\n'],
        ['/fonts/f.woff2', 'COPIE fonts/f.woff2\n'],
      ] as const) {
        const { response, body } = await get(running, path);

        expect(response.status, path).toBe(200);
        expect(body, path).toBe(content);
      }
    });
  });
}
