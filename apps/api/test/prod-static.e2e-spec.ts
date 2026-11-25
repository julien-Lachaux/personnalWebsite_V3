import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { runCompose } from './support/compose.js';

/**
 * Production tout statique (lot 33) : docker/compose.vps-static.yml ne contient que Caddy, sans port ni
 * montage inscriptible du site, et docker/Caddyfile.vps-static ne diffère de docker/Caddyfile.vps que par
 * le préfixe /api/*.
 */
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
  volumes?: { type?: string; source?: string; target?: string; read_only?: boolean }[];
  mem_limit?: string | number;
  pids_limit?: number;
  security_opt?: string[];
  environment?: Record<string, string>;
  depends_on?: unknown;
}

interface ComposeConfig {
  name: string;
  services: Record<string, Service>;
  networks: Record<string, { internal?: boolean }>;
}

function resolve(env: Record<string, string>) {
  return runCompose(['-f', root('docker/compose.vps-static.yml'), 'config', '--format', 'json'], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'] ?? '', HOME: process.env['HOME'] ?? '', ...env },
  });
}

describe('docker/compose.vps-static.yml', () => {
  let config: ComposeConfig;

  beforeAll(() => {
    const result = resolve({ STATIC_SITE_DIR: '/srv/apps/site-perso/site' });
    expect(result.status, result.stderr).toBe(0);
    config = JSON.parse(result.stdout) as ComposeConfig;
  });

  it('n’a qu’un service, Caddy : ni API, ni migration, ni PostgreSQL, ni génération du front', () => {
    expect(Object.keys(config.services)).toEqual(['caddy']);
    for (const name of ['api', 'migrate', 'postgres', 'web-build']) {
      expect(config.services[name], name).toBeUndefined();
    }
    expect(config.services['caddy']?.depends_on).toBeUndefined();
    expect(Object.keys(config.networks)).toEqual(['app']);
    expect(config.networks['app']?.internal).toBe(true);
  });

  it('ne publie aucun port et ne demande aucune capacité', () => {
    const caddy = config.services['caddy'];

    expect(caddy?.ports ?? []).toEqual([]);
    expect(caddy?.cap_add ?? []).toEqual([]);
    expect(caddy?.cap_drop).toEqual(['ALL']);
  });

  it('monte le site en lecture seule, les extraits de configuration en lecture seule, le socket en écriture', () => {
    const volumes = config.services['caddy']?.volumes ?? [];
    const target = (path: string) => volumes.find((volume) => volume.target === path);

    expect(target('/srv/web')?.source).toBe('/srv/apps/site-perso/site');
    expect(target('/srv/web')?.read_only).toBe(true);
    for (const path of [
      '/etc/caddy/Caddyfile',
      '/etc/caddy/wip.caddy',
      '/usr/local/bin/caddy-start.sh',
    ]) {
      expect(target(path)?.read_only, path).toBe(true);
    }
    expect(target('/etc/caddy/Caddyfile')?.source).toMatch(/\/docker\/Caddyfile\.vps-static$/);
    expect(target('/run/prod')?.source).toBe('/run/prod/site-perso');
    expect(target('/run/prod')?.read_only).toBeFalsy();
    // Aucun volume de données de la pile complète (base, site généré en conteneur).
    expect(volumes.map((volume) => volume.source)).not.toContain('web_site');
    expect(volumes.some((volume) => volume.target === '/srv/web' && volume.type !== 'bind')).toBe(
      false,
    );
  });

  it('garde le durcissement : lecture seule, no-new-privileges, ressources bornées, image épinglée', () => {
    const caddy = config.services['caddy'];

    expect(caddy?.read_only).toBe(true);
    expect(caddy?.security_opt).toContain('no-new-privileges:true');
    expect(caddy?.mem_limit).toBeDefined();
    expect(caddy?.pids_limit).toBeGreaterThan(0);
    expect(caddy?.restart).toBe('always');
    expect(caddy?.image).toMatch(
      /^docker\.io\/library\/caddy:2\.(1[1-9]|[2-9]\d)\.\d+@sha256:[0-9a-f]{64}$/,
    );
  });

  it('transmet le mode travaux et accepte un premier essai sans relance (STATIC_RESTART)', () => {
    const result = resolve({
      STATIC_SITE_DIR: '/srv/apps/site-perso/site',
      STATIC_RESTART: 'no',
      WIP_MODE: 'on',
      WIP_KEY: 'a'.repeat(32),
      WIP_API: 'closed',
    });
    expect(result.status, result.stderr).toBe(0);
    const caddy = (JSON.parse(result.stdout) as ComposeConfig).services['caddy'];

    expect(caddy?.restart).toBe('no');
    expect(caddy?.environment).toMatchObject({ WIP_MODE: 'on', WIP_API: 'closed' });
  });

  it('refuse de se résoudre sans le dossier du site', () => {
    const result = resolve({});

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('STATIC_SITE_DIR');
  });

  it('ne dépend d’aucune variable de secret de la pile complète', () => {
    const text = read('docker/compose.vps-static.yml');

    for (const secret of ['POSTGRES_PASSWORD', 'API_DB_PASSWORD', 'DATABASE_URL', 'CORS_ORIGIN']) {
      expect(text).not.toContain(secret);
    }
  });
});

/** Le bloc `handle /api/* { … }` du Caddyfile (jusqu'à son accolade fermante, au même retrait). */
function apiBlock(caddyfile: string): { start: number; end: number } {
  const start = caddyfile.indexOf('\thandle /api/* {\n');
  expect(start).toBeGreaterThan(0);
  const end = caddyfile.indexOf('\n\t}\n', start) + '\n\t}\n'.length;
  return { start, end };
}

describe('docker/Caddyfile.vps-static', () => {
  const vps = read('docker/Caddyfile.vps');
  const statique = read('docker/Caddyfile.vps-static');

  it('ne diffère de la variante VPS que par le préfixe /api/* (CSP, /fr, travaux, erreurs identiques)', () => {
    const sansApi = (text: string) => {
      const { start, end } = apiBlock(text);
      return text.slice(0, start) + text.slice(end);
    };
    // Commentaires d'en-tête de la variante statique, puis le bloc d'options et tout le reste du site.
    const corps = (text: string) => text.slice(text.indexOf('\n{\n'));
    // Commentaires de tête du bloc /api/* mis à part (ils décrivent l'amont) : ils précèdent `handle /api/*`.
    const sansCommentaireApi = (text: string) =>
      text.replace(/(\t#[^\n]*\n)+(?=\thandle \/api\/\* \{)/, '');

    expect(corps(sansApi(sansCommentaireApi(statique)))).toBe(
      corps(sansApi(sansCommentaireApi(vps))),
    );
  });

  it('répond 410 en problem+json sur /api/*, sans amont ni plafond de corps', () => {
    const { start, end } = apiBlock(statique);
    const bloc = statique.slice(start, end);

    expect(bloc).toContain('Content-Type "application/problem+json"');
    expect(bloc).toContain('"status":410');
    expect(bloc).toMatch(/` 410\n/);
    const directives = statique.replace(/^\s*#.*$/gm, '');
    expect(directives).not.toContain('reverse_proxy');
    expect(directives).not.toContain('api:3000');
    expect(directives).not.toContain('request_body');
  });

  it('écoute le même socket et garde le mode travaux, la CSP et la liste blanche de /fr', () => {
    for (const fragment of [
      'bind unix//run/prod/web.sock|0660',
      'trusted_proxies_unix',
      'import wip-{$WIP_MODE:off}',
      'import /srv/web/current/csp.*',
      'vars_regexp frbad',
      '/50x.html',
    ]) {
      expect(statique, fragment).toContain(fragment);
    }
  });
});
