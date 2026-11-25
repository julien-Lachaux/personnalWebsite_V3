import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Mode travaux et pages d'erreur du Caddy de la pile (lot 32), rejoués contre le VRAI Caddyfile.vps
 * (corps identique à docker/Caddyfile, vérifié par prod-vps.e2e-spec.ts), docker/wip.caddy et
 * docker/caddy-start.sh, dans un conteneur Caddy seul : site factice (pages en une ligne), pas d'API
 * (le proxy répond 502). Seuls changements du Caddyfile d'essai : écoute TCP au lieu du socket Unix, et
 * une route `/boom/*` qui produit une erreur 503 (aucune autre façon de provoquer une erreur 50x hors API).
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

// Clé factice de l'essai (aucune valeur réelle) et empreinte attendue du cookie (SHA-256 de « wip:<clé> »).
const KEY = 'cle-factice-de-test-0123456789abcdef0123456789';

const dir = mkdtempSync(join(tmpdir(), 'siteperso-wip-'));
const pages = [
  'index.html',
  'en/index.html',
  'travaux/index.html',
  'en/work-in-progress/index.html',
  '404.html',
  'en/404.html',
  '50x.html',
  'en/50x.html',
  '_nuxt/a.css',
  'fonts/f.woff2',
  'robots.txt',
  'sitemap.xml',
  'cv/cv-fr.pdf',
  'travaux/_payload.json',
  'en/work-in-progress/_payload.json',
];
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
  readFileSync(root('docker/Caddyfile.vps'), 'utf8')
    .replace(/\tbind unix[^\n]*/, '\tbind 0.0.0.0')
    .replace(
      '\thandle /api/* {',
      '\t@boom path /boom/* /en/boom/*\n\thandle @boom {\n\t\terror 503\n\t}\n\thandle /api/* {',
    ),
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

/** Démarre Caddy (entrypoint de production) avec ces variables ; renvoie l'adresse publiée. */
function start(env: Record<string, string>): Running {
  const name = `siteperso-wip-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
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
    ...envArgs,
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

function stop(running: Running | undefined) {
  if (running) {
    engineRun(['rm', '-f', running.name]);
  }
}

async function get(running: Running, path: string, cookie?: string) {
  const response = await fetch(`${running.base}${path}`, {
    redirect: 'manual',
    headers: cookie ? { Cookie: cookie } : {},
  });
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

async function cookieFor(running: Running): Promise<string> {
  const { response } = await get(running, `/?acces=${KEY}`);
  return /^(acces=[0-9a-f]{64});/.exec(response.headers.getSetCookie()[0] ?? '')?.[1] ?? '';
}

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

if (engine === '' || !image) {
  describe('mode travaux (moteur de conteneurs absent)', () => {
    it('moteur de conteneurs introuvable : scénarios non rejoués', () => {
      expect(process.env['CI'], 'moteur de conteneurs attendu en CI').toBeUndefined();
    });
  });
} else {
  describe('pages d’erreur (mode travaux éteint par défaut)', () => {
    let running: Running;
    beforeAll(async () => {
      running = start({});
      await waitReady(running);
    }, 60_000);
    afterAll(() => stop(running));

    it('sert le site normalement, sans redirection', async () => {
      const { response, body } = await get(running, '/');

      expect(response.status).toBe(200);
      expect(body).toBe('PAGE index.html\n');
      expect(response.headers.get('set-cookie')).toBeNull();
    });

    it('sert la page 404 française ou anglaise avec le statut 404, la CSP et no-cache', async () => {
      for (const [path, page] of [
        ['/inconnue', '404.html'],
        ['/en/unknown', 'en/404.html'],
      ] as const) {
        const { response, body } = await get(running, path);

        expect(response.status, path).toBe(404);
        expect(body).toBe(`PAGE ${page}\n`);
        expect(response.headers.get('content-security-policy')).toBe("default-src 'self'");
        expect(response.headers.get('cache-control')).toBe('no-cache');
      }
    });

    it('sert 50x.html ou en/50x.html par réécriture, avec le statut de l’erreur, la CSP et no-cache', async () => {
      for (const [path, page] of [
        ['/boom/x', '50x.html'],
        ['/en/boom/x', 'en/50x.html'],
      ] as const) {
        const { response, body } = await get(running, path);

        expect(response.status, path).toBe(503);
        expect(body).toBe(`PAGE ${page}\n`);
        expect(response.headers.get('content-security-policy')).toBe("default-src 'self'");
        expect(response.headers.get('cache-control')).toBe('no-cache');
        expect(response.headers.get('location')).toBeNull();
      }
    });

    it('laisse /api/* répondre comme avant : 502 en texte brut quand l’API est arrêtée, jamais la page 50x', async () => {
      const { response, body } = await get(running, '/api/v1/health');

      expect(response.status).toBe(502);
      expect(response.headers.get('content-type')).toContain('text/plain');
      expect(body).toBe('502 Bad Gateway');
    });
  });

  describe('mode travaux actif (WIP_MODE=on, API ouverte)', () => {
    let running: Running;
    let cookie: string;
    beforeAll(async () => {
      running = start({ WIP_MODE: 'on', WIP_KEY: KEY });
      await waitReady(running);
      cookie = await cookieFor(running);
    }, 60_000);
    afterAll(() => stop(running));

    it('redirige toute page vers la page travaux de la langue (302, no-store)', async () => {
      for (const [path, target] of [
        ['/', '/travaux'],
        ['/accessibilite?x=1', '/travaux'],
        ['/cv/cv-fr.pdf', '/travaux'],
        ['/sitemap.xml', '/travaux'],
        ['/fr/accessibilite', '/travaux'],
        ['/en', '/en/work-in-progress'],
        ['/en/accessibility', '/en/work-in-progress'],
      ]) {
        const { response } = await get(running, path ?? '/');

        expect(response.status, path).toBe(302);
        expect(response.headers.get('location'), path).toBe(target);
        expect(response.headers.get('cache-control'), path).toBe('no-store');
      }
    });

    it('sert la page travaux en 503 avec Retry-After, noindex, la CSP du front et no-cache', async () => {
      for (const [path, page] of [
        ['/travaux', 'travaux/index.html'],
        ['/en/work-in-progress', 'en/work-in-progress/index.html'],
      ]) {
        const { response, body } = await get(running, path ?? '/');

        expect(response.status, path).toBe(503);
        expect(body).toBe(`PAGE ${page}\n`);
        expect(response.headers.get('retry-after')).toBe('3600');
        expect(response.headers.get('x-robots-tag')).toBe('noindex');
        expect(response.headers.get('content-security-policy')).toBe("default-src 'self'");
        expect(response.headers.get('cache-control')).toBe('no-cache');
      }
    });

    it('laisse passer les ressources de la page (statiques, charges utiles, robots.txt)', async () => {
      for (const path of [
        '/_nuxt/a.css',
        '/fonts/f.woff2',
        '/robots.txt',
        '/travaux/_payload.json',
        '/en/work-in-progress/_payload.json',
      ]) {
        const { response } = await get(running, path);

        expect(response.status, path).toBe(200);
      }
    });

    it('laisse /api/* ouverte', async () => {
      const { response } = await get(running, '/api/v1/health');

      expect(response.status).toBe(502); // l'API n'existe pas dans cet essai : le proxy n'est pas intercepté
      expect(response.headers.get('location')).toBeNull();
    });

    it('clé valide : cookie HttpOnly Secure SameSite=Lax de 30 jours, empreinte et non la clé, retour sans le paramètre', async () => {
      const { response, body } = await get(running, `/en/?acces=${KEY}&b=2`);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/en/?b=2');
      expect(response.headers.get('cache-control')).toBe('no-store');
      const setCookie = response.headers.getSetCookie()[0] ?? '';
      expect(setCookie).toMatch(
        /^acces=[0-9a-f]{64}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=2592000$/,
      );
      expect(setCookie).not.toContain(KEY);
      expect(body).not.toContain(KEY);
    });

    it('cookie valide : le site s’affiche normalement, pages travaux comprises', async () => {
      expect(cookie).toMatch(/^acces=[0-9a-f]{64}$/);

      for (const [path, page] of [
        ['/', 'index.html'],
        ['/en', 'en/index.html'],
        ['/cv/cv-fr.pdf', 'cv/cv-fr.pdf'],
      ]) {
        const { response, body } = await get(running, path ?? '/', `autre=1; ${cookie}`);

        expect(response.status, path).toBe(200);
        expect(body).toBe(`PAGE ${page}\n`);
      }
      expect((await get(running, '/inconnue', cookie)).response.status).toBe(404);
    });

    it('clé fausse ou cookie faux : comportement du mode actif, sans pose de cookie ni indice', async () => {
      const wrong = await get(running, '/?acces=cle-fausse-0123456789abcdef0123456789abcdef');
      const forged = await get(running, '/', `acces=${'0'.repeat(64)}`);
      const raw = await get(running, '/', `acces=${KEY}`);

      for (const { response } of [wrong, forged, raw]) {
        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe('/travaux');
        expect(response.headers.get('set-cookie')).toBeNull();
      }
    });

    it('ne journalise jamais la clé (paramètre retiré de l’URI)', async () => {
      await get(running, `/?acces=${KEY}&autre=1`);
      await get(running, '/?acces=cle-fausse-0123456789abcdef0123456789abcdef');
      const logs = engineRun(['logs', running.name]);
      const output = `${logs.stdout}${logs.stderr}`;

      expect(output).toContain('"uri":"/?autre=1"');
      expect(output).not.toContain(KEY);
      expect(output).not.toContain('cle-fausse');
      expect(output).not.toMatch(/acces=/);
    });
  });

  describe('mode travaux : réglages', () => {
    it('WIP_API=closed : 503 problem+json sans cookie, API ouverte avec cookie', async () => {
      const running = start({ WIP_MODE: 'on', WIP_KEY: KEY, WIP_API: 'closed' });
      try {
        await waitReady(running);
        const closed = await get(running, '/api/v1/health');
        const open = await get(running, '/api/v1/health', await cookieFor(running));

        expect(closed.response.status).toBe(503);
        expect(closed.response.headers.get('content-type')).toBe('application/problem+json');
        expect(closed.body).toBe(
          '{"type":"about:blank","title":"Service Unavailable","status":503}',
        );
        expect(open.response.status).toBe(502);
      } finally {
        stop(running);
      }
    }, 60_000);

    it('WIP_STATUS et WIP_RETRY_AFTER changent le statut et l’en-tête de la page', async () => {
      const running = start({
        WIP_MODE: 'on',
        WIP_KEY: KEY,
        WIP_STATUS: '200',
        WIP_RETRY_AFTER: '120',
      });
      try {
        await waitReady(running);
        const { response } = await get(running, '/travaux');

        expect(response.status).toBe(200);
        expect(response.headers.get('retry-after')).toBe('120');
      } finally {
        stop(running);
      }
    }, 60_000);
  });

  describe('mode travaux : refus de démarrer', () => {
    function refused(env: Record<string, string>) {
      const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
      return engineRun([
        'run',
        '--rm',
        '--security-opt',
        'label=disable',
        ...envArgs,
        '--entrypoint',
        '/bin/sh',
        '-v',
        `${root('docker/caddy-start.sh')}:/usr/local/bin/caddy-start.sh:ro`,
        image ?? '',
        '/usr/local/bin/caddy-start.sh',
      ]);
    }

    it.each([
      [{ WIP_MODE: 'on' }, 'au moins 32 caractères'],
      [{ WIP_MODE: 'on', WIP_KEY: 'trop-courte' }, 'au moins 32 caractères'],
      [{ WIP_MODE: 'on', WIP_KEY: `${KEY}/;"` }, 'ne peut contenir que'],
      [{ WIP_MODE: 'oui', WIP_KEY: KEY }, 'attendu on ou off'],
      [{ WIP_MODE: 'off', WIP_API: 'peut-etre' }, 'attendu open ou closed'],
    ])(
      '%j : le conteneur s’arrête avec un message clair',
      (env, message) => {
        const result = refused(env);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(message);
        expect(`${result.stdout}${result.stderr}`).not.toContain(KEY);
      },
      60_000,
    );
  });
}
