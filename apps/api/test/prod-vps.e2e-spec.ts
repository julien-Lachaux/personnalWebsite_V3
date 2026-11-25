import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { runCompose } from './support/compose.js';

const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(root(path), 'utf8');

interface Service {
  image?: string;
  ports?: unknown[];
  cap_add?: string[];
  cap_drop?: string[];
  read_only?: boolean;
  restart?: string;
  networks?: Record<string, unknown>;
  volumes?: { source?: string; target?: string }[];
  oom_score_adj?: number;
  mem_limit?: string | number;
  pids_limit?: number;
  security_opt?: string[];
  healthcheck?: { test?: string[] };
  user?: string;
}

interface ComposeConfig {
  services: Record<string, Service>;
  networks: Record<string, { internal?: boolean }>;
}

/** Résout compose.prod.yml, avec ou sans la variante VPS, par le moteur compose du poste. */
function resolve(files: string[]): ComposeConfig {
  const result = runCompose(
    [...files.flatMap((file) => ['-f', root(file)]), 'config', '--format', 'json'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        SITE_DOMAIN: 'example.test',
        POSTGRES_PASSWORD: 'proprietaire',
        API_DB_PASSWORD: 'lecture',
        CORS_ORIGIN: 'https://example.test',
        PROD_RUN_DIR: '/run/prod/site-perso',
      },
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as ComposeConfig;
}

/** Corps du site d'un Caddyfile : tout ce qui suit la ligne d'ouverture du bloc de site. */
function siteBody(caddyfile: string, opening: string): string {
  const start = caddyfile.indexOf(`\n${opening}\n`) + 1;
  expect(start, `bloc ${opening} introuvable`).toBeGreaterThan(0);
  return caddyfile.slice(start + opening.length + 1);
}

describe('variante VPS (docker/compose.vps.yml, Podman sans privilèges)', () => {
  let base: ComposeConfig;
  let vps: ComposeConfig;

  beforeAll(() => {
    base = resolve(['docker/compose.prod.yml']);
    vps = resolve(['docker/compose.prod.yml', 'docker/compose.vps.yml']);
  });

  it('ne publie aucun port, sans NET_BIND_SERVICE ni réseau edge (la pile locale garde ses ports)', () => {
    for (const [name, service] of Object.entries(vps.services)) {
      expect(service.ports ?? [], `ports de ${name}`).toEqual([]);
      expect(service.cap_add ?? [], `cap_add de ${name}`).not.toContain('NET_BIND_SERVICE');
    }
    expect(Object.keys(vps.services['caddy']?.networks ?? {})).toEqual(['app']);

    // La pile locale, elle, est inchangée.
    expect(base.services['caddy']?.ports?.length).toBe(3);
    expect(base.services['caddy']?.cap_add).toContain('NET_BIND_SERVICE');
  });

  it('monte le dossier du socket, sans utilisateur imposé à Caddy', () => {
    const caddy = vps.services['caddy'];

    expect(
      caddy?.volumes?.some((v) => v.source === '/run/prod/site-perso' && v.target === '/run/prod'),
    ).toBe(true);
    expect(
      caddy?.volumes?.some(
        (v) => v.target === '/etc/caddy/Caddyfile' && v.source?.endsWith('/docker/Caddyfile.vps'),
      ),
    ).toBe(true);
    // Seul le root du conteneur peut créer le socket dans le dossier 2750 de l'hôte.
    expect(caddy?.user).toBeUndefined();
    expect(caddy?.read_only).toBe(true);
    expect(caddy?.cap_drop).toEqual(['ALL']);
  });

  it('relance au démarrage (restart: always) Caddy, l’API et PostgreSQL', () => {
    for (const name of ['caddy', 'api', 'postgres']) {
      expect(vps.services[name]?.restart, name).toBe('always');
    }
  });

  it('garde le durcissement de la production (lecture seule, capacités, ressources, réseaux internes)', () => {
    for (const name of ['caddy', 'api', 'migrate', 'postgres']) {
      const service = vps.services[name];
      expect(service?.read_only, name).toBe(true);
      expect(service?.cap_drop, name).toEqual(['ALL']);
      expect(service?.security_opt, name).toContain('no-new-privileges:true');
      expect(service?.mem_limit, name).toBeDefined();
      expect(service?.pids_limit, name).toBeGreaterThan(0);
    }
    expect(vps.networks['app']?.internal).toBe(true);
    expect(vps.networks['data']?.internal).toBe(true);
  });

  it('fixe un oom_score_adj : PostgreSQL est tué après l’API, Caddy et la génération du front', () => {
    const score = (name: string) => vps.services[name]?.oom_score_adj;

    expect(score('postgres')).toBeDefined();
    for (const name of ['api', 'caddy', 'migrate']) {
      expect(score(name), name).toBeGreaterThan(score('postgres') ?? Infinity);
    }
  });

  it('nomme chaque image avec son registre (noms courts refusés au compte de l’appli) et épingle les tierces', () => {
    for (const [name, service] of Object.entries(vps.services)) {
      expect(service.image, name).toMatch(/^(docker\.io|localhost|mcr\.microsoft\.com)\//);
    }
    expect(vps.services['caddy']?.image).toMatch(
      /^docker\.io\/library\/caddy:2\.(1[1-9]|[2-9]\d)\.\d+@sha256:[0-9a-f]{64}$/,
    );
    expect(vps.services['postgres']?.image).toMatch(/@sha256:[0-9a-f]{64}$/);
  });

  it('déclare le healthcheck de l’API dans le compose (indépendant du format de l’image)', () => {
    expect(JSON.stringify(base.services['api']?.healthcheck)).toContain('/api/v1/health');
    expect(JSON.stringify(vps.services['api']?.healthcheck)).toContain('/api/v1/health');
  });
});

describe('images et Dockerfiles : noms complets (L29-02)', () => {
  it('chaque FROM, ARG *_IMAGE et image: tiers porte son registre et un digest', () => {
    const sources = [
      'docker/api.Dockerfile',
      'docker/web.Dockerfile',
      'docker/compose.prod.yml',
      'docker/compose.vps.yml',
      'docker/compose.vps-frontal.yml',
    ];
    const references: string[] = [];
    for (const source of sources) {
      const text = read(source);
      for (const match of text.matchAll(/^ARG \w+_IMAGE=(\S+)$/gm)) references.push(match[1] ?? '');
      for (const match of text.matchAll(/^\s+image: (\S+)$/gm)) references.push(match[1] ?? '');
      for (const match of text.matchAll(/^FROM (\S+)/gm)) {
        const from = match[1] ?? '';
        // Un étage interne (`FROM deps`, `FROM ${NODE_IMAGE}`) n'est pas une image.
        if (!/^(\$\{|[a-z]+$)/.test(from)) references.push(from);
      }
    }

    expect(references.length).toBeGreaterThan(5);
    for (const reference of references) {
      if (reference.startsWith('localhost/') || reference.startsWith('siteperso-')) continue;
      expect(reference, reference).toMatch(/^[a-z0-9.-]+\.[a-z]+\/\S+@sha256:[0-9a-f]{64}$/);
    }
  });
});

describe('docker/Caddyfile.vps', () => {
  const vpsFile = read('docker/Caddyfile.vps');

  it('écoute sur le socket Unix en 0660, sans TLS ni redirection HTTP, et croit le frontal', () => {
    expect(vpsFile).toContain('bind unix//run/prod/web.sock|0660');
    expect(vpsFile).toMatch(/servers \{\s+trusted_proxies_unix\s+\}/);
    expect(vpsFile).toContain('auto_https off');
    expect(vpsFile).not.toMatch(/redir https/);
    expect(vpsFile).not.toContain('{$SITE_DOMAIN');
  });

  it('a le même site (CSP, /fr, /api, plafond de corps, erreurs) que docker/Caddyfile', () => {
    const local = siteBody(read('docker/Caddyfile'), '{$SITE_DOMAIN:localhost} {');
    const vps = siteBody(vpsFile, '\tbind unix//run/prod/web.sock|0660');

    expect(vps).toBe(local);
    expect(vps).toContain('max_size 1KB');
    expect(vps).toContain('import /srv/web/current/csp.*');
    expect(vps).toContain('-Server');
    expect(vps).toContain('-Via');
  });
});
