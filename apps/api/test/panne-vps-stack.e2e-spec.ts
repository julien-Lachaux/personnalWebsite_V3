import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Panne de l'API, puis de la pile entière, rejouées sur la pile d'essai de la variante VPS (D48, lot 35) :
 * client -> Caddy de l'hôte simulé (docker/host-errors.caddy) -> socket Unix -> Caddy de la pile -> API.
 * Même détection que vps-stack.e2e-spec.ts : sans pile (`bash scripts/deploy/vps-stack.sh up`), un test unique
 * le consigne ; VPS_STACK_REQUIRED=1 fait échouer l'absence. Le test arrête l'API puis le Caddy de la pile
 * et les relance en fin de fichier : ne pas le jouer en même temps que vps-stack.e2e-spec.ts.
 * Le site publié de la pile est un site factice (pages en une ligne, pas de génération Nuxt) écrit dans le
 * volume du site de l'essai.
 */
const script = fileURLToPath(new URL('../../../scripts/deploy/vps-stack.sh', import.meta.url));
const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const envFile = process.env['VPS_STACK_ENV_FILE'] ?? root('docker/.env.vps-test');
const required = process.env['VPS_STACK_REQUIRED'] === '1';

const DETAIL = 'Le service est momentanément indisponible. Réessayez dans quelques instants.';
const CSP = "default-src 'self'";

function stack(args: string[]) {
  return spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PODMAN_COMPOSE_WARNING_LOGS: 'false' },
  });
}

interface Raw {
  status: number;
  headers: Map<string, string>;
  body: string;
}

/** GET brut (HTTP/1.0) du client vers le frontal : l'erreur 5xx et son corps sont lus tels quels. */
function raw(path: string): Raw {
  const result = stack([
    'exec',
    'client-a',
    'sh',
    '-c',
    `(printf 'GET ${path} HTTP/1.0\\r\\nHost: x\\r\\n\\r\\n'; sleep 1) | nc frontal 8080`,
  ]);
  const [head = '', ...rest] = result.stdout.replaceAll('\r\n', '\n').split('\n\n');
  const [statusLine = '', ...lines] = head.split('\n');
  const headers = new Map<string, string>();
  for (const line of lines) {
    const separator = line.indexOf(':');
    headers.set(line.slice(0, separator).toLowerCase(), line.slice(separator + 1).trim());
  }
  return {
    status: Number(/^HTTP\/1\.[01] (\d+)/.exec(statusLine)?.[1] ?? '0'),
    headers,
    body: rest.join('\n\n'),
  };
}

function healthy(): boolean {
  return (
    stack([
      'exec',
      'client-a',
      'wget',
      '-q',
      '-O',
      '/dev/null',
      'http://frontal:8080/api/v1/health',
    ]).status === 0
  );
}

async function waitHealthy() {
  for (let i = 0; i < 60 && !healthy(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

function envValue(name: string): string {
  return new RegExp(`^${name}=(.*)$`, 'm').exec(readFileSync(envFile, 'utf8'))?.[1] ?? '';
}

const engineResult = spawnSync(
  'bash',
  ['-c', `source ${root('scripts/container-engine.sh')} && container_engine`],
  { encoding: 'utf8' },
);
const engine = engineResult.status === 0 ? engineResult.stdout.trim() : '';
const image = /image: (docker\.io\/library\/caddy:\S+)/.exec(
  readFileSync(root('docker/compose.vps-frontal.yml'), 'utf8'),
)?.[1];

const available =
  engine !== '' &&
  existsSync(envFile) &&
  stack(['exec', 'client-a', 'true']).status === 0 &&
  healthy();

/** Site factice publié dans le volume du site de la pile : pages en une ligne, CSP fixe, lien `current`. */
const siteCommand = [
  'mkdir -p /site/releases/r1/public/en /site/releases/r1/public/_nuxt /site/releases/r1/public/fonts',
  'cd /site/releases/r1',
  'for page in index.html en/index.html 404.html en/404.html 50x.html en/50x.html _nuxt/a.css fonts/f.woff2; do echo "PAGE $page" > "public/$page"; done',
  `echo 'header Content-Security-Policy "${CSP}"' > csp.caddy`,
  'ln -sfn releases/r1 /site/current',
].join(' && ');

if (!available) {
  describe('panne sur la pile de la variante VPS (absente)', () => {
    it(
      required
        ? 'la pile VPS est attendue (VPS_STACK_REQUIRED=1) mais ne répond pas : lancer `bash scripts/deploy/vps-stack.sh up`'
        : 'pile VPS non démarrée : scénarios non rejoués (`bash scripts/deploy/vps-stack.sh up` pour les jouer)',
      () => {
        expect(required, `pile injoignable via ${envFile}`).toBe(false);
      },
    );
  });
} else {
  describe('panne de l’API puis de la pile, pile d’essai VPS (D48)', () => {
    beforeAll(() => {
      const published = spawnSync(
        engine,
        [
          'run',
          '--rm',
          '--security-opt',
          'label=disable',
          '-v',
          `${envValue('COMPOSE_PROJECT_NAME')}_web_site:/site`,
          '--entrypoint',
          'sh',
          image ?? '',
          '-c',
          siteCommand,
        ],
        { encoding: 'utf8' },
      );
      expect(published.status, published.stderr).toBe(0);
      const reloaded = stack([
        'exec',
        'caddy',
        'caddy',
        'reload',
        '--config',
        '/etc/caddy/Caddyfile',
        '--force',
      ]);
      expect(reloaded.status, reloaded.stderr).toBe(0);
      const copied = stack(['errors']);
      expect(copied.status, copied.stderr).toBe(0);
    }, 120_000);

    afterAll(async () => {
      stack(['start', 'caddy', 'api']);
      await waitHealthy();
    }, 180_000);

    it('API arrêtée : /api/* en 502 problem+json minimal, les pages du site restent servies', () => {
      expect(stack(['stop', 'api']).status).toBe(0);

      const api = raw('/api/v1/profile');
      expect(api.status).toBe(502);
      expect(api.headers.get('content-type')).toBe('application/problem+json');
      expect(api.body).toBe(
        `{"type":"about:blank","title":"Bad Gateway","status":502,"detail":"${DETAIL}"}`,
      );
      expect(api.headers.get('cache-control')).toBe('no-store');
      expect(api.headers.get('retry-after')).toBe('30');
      expect(api.headers.get('content-security-policy')).toBe(
        "default-src 'none';frame-ancestors 'none'",
      );
      expect(api.headers.get('x-frame-options')).toBe('DENY');
      expect(api.headers.get('x-content-type-options')).toBe('nosniff');
      expect(api.headers.has('server')).toBe(false);

      const home = raw('/');
      expect(home.status).toBe(200);
      expect(home.body).toBe('PAGE index.html\n');
      const unknown = raw('/en/inconnue');
      expect(unknown.status).toBe(404);
      expect(unknown.body).toBe('PAGE en/404.html\n');
    }, 120_000);

    it('API relancée : /api/* répond de nouveau', async () => {
      expect(stack(['start', 'api']).status).toBe(0);
      await waitHealthy();

      expect(raw('/api/v1/health').status).toBe(200);
    }, 180_000);

    it('pile arrêtée : /api/* en 502 problem+json (hôte), pages en 502 avec la page 50x de la langue', () => {
      expect(stack(['stop', 'caddy']).status).toBe(0);

      const api = raw('/api/v1/profile');
      expect(api.status).toBe(502);
      expect(api.headers.get('content-type')).toBe('application/problem+json');
      expect(api.body).toBe(
        `{"type":"about:blank","title":"Bad Gateway","status":502,"detail":"${DETAIL}"}`,
      );
      expect(api.headers.get('cache-control')).toBe('no-store');
      expect(api.headers.get('retry-after')).toBe('30');
      expect(api.headers.has('server')).toBe(false);

      for (const [path, page] of [
        ['/', '50x.html'],
        ['/accessibilite', '50x.html'],
        ['/en', 'en/50x.html'],
        ['/en/accessibility', 'en/50x.html'],
      ] as const) {
        const response = raw(path);

        expect(response.status, path).toBe(502);
        expect(response.body, path).toBe(`PAGE ${page}\n`);
        expect(response.headers.get('content-security-policy'), path).toBe(CSP);
        expect(response.headers.get('cache-control'), path).toBe('no-cache');
        expect(response.headers.has('server'), path).toBe(false);
      }
    }, 120_000);

    it('pile arrêtée : les ressources de la page de secours (/_nuxt/*, /fonts/*) sont servies en 200', () => {
      expect(raw('/_nuxt/a.css')).toMatchObject({ status: 200, body: 'PAGE _nuxt/a.css\n' });
      expect(raw('/fonts/f.woff2')).toMatchObject({ status: 200, body: 'PAGE fonts/f.woff2\n' });
    });
  });
}
