import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Panne de l'API vue par le Caddy de la pile (D48, lot 35), rejouée contre le VRAI docker/Caddyfile.vps
 * (corps identique à docker/Caddyfile et à docker/Caddyfile.vps-static, vérifié par prod-vps et prod-static)
 * dans un conteneur Caddy seul : site factice, pas d'API (`api:3000` ne se résout pas : 502). Changements
 * du Caddyfile d'essai : écoute TCP au lieu du socket Unix ; des routes d'essai qui produisent les erreurs
 * 500, 503 et 504 de Caddy (sous /api/* et hors /api/*) ; une route `/api/amont/*` relayée vers un amont
 * factice (second site du même Caddy) qui répond lui-même un 500 problem+json, pour prouver qu'une erreur
 * de l'API traverse reverse_proxy sans être réécrite.
 */
const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const engineResult = spawnSync(
  'bash',
  ['-c', `source ${root('scripts/container-engine.sh')} && container_engine`],
  { encoding: 'utf8' },
);
const engine = engineResult.status === 0 ? engineResult.stdout.trim() : '';
const image = /image: (docker\.io\/library\/caddy:\S+)/.exec(
  readFileSync(root('docker/compose.vps.yml'), 'utf8'),
)?.[1];

const DETAIL = 'Le service est momentanément indisponible. Réessayez dans quelques instants.';
const UPSTREAM_BODY =
  '{"type":"about:blank","title":"Erreur interne","status":500,"detail":"Erreur de l’API elle-même."}';

const dir = mkdtempSync(join(tmpdir(), 'siteperso-panne-api-'));
const pages = ['index.html', '404.html', 'en/404.html', '50x.html', 'en/50x.html'];
mkdirSync(join(dir, 'site/public'), { recursive: true });
writeFileSync(
  join(dir, 'site/csp.caddy'),
  'header Content-Security-Policy "default-src \'self\'"\n',
);
for (const page of pages) {
  mkdirSync(dirname(join(dir, 'site/public', page)), { recursive: true });
  writeFileSync(join(dir, 'site/public', page), `PAGE ${page}\n`);
}
writeFileSync(
  join(dir, 'Caddyfile'),
  `${readFileSync(root('docker/Caddyfile.vps'), 'utf8')
    .replace(/\tbind unix[^\n]*/, '\tbind 0.0.0.0')
    .replace(
      '\thandle /api/* {',
      [
        '\t@boomfront path /boom/* /en/boom/*',
        '\thandle @boomfront {\n\t\terror 503\n\t}',
        ...[500, 503, 504].map(
          (status) => `\thandle /api/boom/${status} {\n\t\terror ${status}\n\t}`,
        ),
        '\thandle /api/amont/* {\n\t\trewrite * /\n\t\treverse_proxy 127.0.0.1:9000\n\t}',
        '\thandle /api/* {',
      ].join('\n'),
    )}\nhttp://:9000 {\n\theader Content-Type "application/problem+json"\n\trespond \`${UPSTREAM_BODY}\` 500\n}\n`,
);
chmodSync(dir, 0o755);
for (const sub of ['site', 'site/public']) {
  chmodSync(join(dir, sub), 0o755);
}

interface Running {
  base: string;
  name: string;
}

function engineRun(args: string[]) {
  return spawnSync(engine, args, { encoding: 'utf8' });
}

function start(): Running {
  const name = `siteperso-panne-api-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
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
    '--entrypoint',
    '/bin/sh',
    '-v',
    `${join(dir, 'Caddyfile')}:/etc/caddy/Caddyfile:ro`,
    '-v',
    `${root('docker/wip.caddy')}:/etc/caddy/wip.caddy:ro`,
    '-v',
    `${root('docker/caddy-start.sh')}:/usr/local/bin/caddy-start.sh:ro`,
    '-v',
    `${join(dir, 'site')}:/srv/web/current:ro`,
    image ?? '',
    '/usr/local/bin/caddy-start.sh',
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
  describe('panne de l’API, Caddy de la pile (moteur de conteneurs absent)', () => {
    it('moteur de conteneurs introuvable : scénarios non rejoués', () => {
      expect(process.env['CI'], 'moteur de conteneurs attendu en CI').toBeUndefined();
    });
  });
} else {
  describe('panne de l’API, Caddy de la pile (D48)', () => {
    let running: Running;
    beforeAll(async () => {
      running = start();
      await waitReady(running);
    }, 60_000);
    afterAll(() => {
      engineRun(['rm', '-f', running.name]);
    });

    it('API injoignable : 502 problem+json minimal sous /api/*, jamais la page HTML', async () => {
      const { response, body } = await get(running, '/api/v1/profile');

      expect(response.status).toBe(502);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
      expect(body).toBe(
        `{"type":"about:blank","title":"Bad Gateway","status":502,"detail":"${DETAIL}"}`,
      );
      expect(JSON.parse(body)).toEqual({
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        detail: DETAIL,
      });
    });

    it.each([
      [500, 'Internal Server Error'],
      [503, 'Service Unavailable'],
      [504, 'Gateway Timeout'],
    ])(
      'erreur %i de Caddy sous /api/* : problem+json au statut d’origine',
      async (status, title) => {
        const { response, body } = await get(running, `/api/boom/${status}`);

        expect(response.status).toBe(status);
        expect(response.headers.get('content-type')).toBe('application/problem+json');
        expect(body).toBe(
          `{"type":"about:blank","title":"${title}","status":${status},"detail":"${DETAIL}"}`,
        );
      },
    );

    it('pose les en-têtes de /api/* : no-store, Retry-After, CSP, cadres interdits, nosniff, sans Server', async () => {
      const { response } = await get(running, '/api/v1/profile');

      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('retry-after')).toBe('30');
      expect(response.headers.get('content-security-policy')).toBe(
        "default-src 'none';frame-ancestors 'none'",
      );
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('server')).toBeNull();
    });

    it('la requête n’est pas une page : même réponse pour une méthode d’écriture', async () => {
      const { response, body } = await get(running, '/api/v1/profile', { method: 'POST' });

      expect(response.status).toBe(502);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
      expect(JSON.parse(body)).toMatchObject({ status: 502, title: 'Bad Gateway' });
    });

    it('erreur 500 produite par l’API elle-même : transmise inchangée par Caddy', async () => {
      const { response, body } = await get(running, '/api/amont/x');

      expect(response.status).toBe(500);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
      expect(body).toBe(UPSTREAM_BODY);
      expect(response.headers.get('retry-after')).toBeNull();
      expect(response.headers.get('cache-control')).toBeNull();
    });

    it('hors /api/* : la page 50x du front (fr, en) avec le statut de l’erreur', async () => {
      for (const [path, page] of [
        ['/boom/x', '50x.html'],
        ['/en/boom/x', 'en/50x.html'],
      ] as const) {
        const { response, body } = await get(running, path);

        expect(response.status, path).toBe(503);
        expect(response.headers.get('content-type'), path).toContain('text/html');
        expect(body).toBe(`PAGE ${page}\n`);
        expect(response.headers.get('server')).toBeNull();
      }
    });
  });
}
