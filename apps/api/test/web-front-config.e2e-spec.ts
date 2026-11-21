import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const composeFile = root('docker/compose.prod.yml');
const read = (path: string) => readFileSync(root(path), 'utf8');

interface Service {
  profiles?: string[];
  networks?: Record<string, unknown>;
  read_only?: boolean;
  cap_drop?: string[];
  cap_add?: string[];
  security_opt?: string[];
  mem_limit?: string | number;
  pids_limit?: number;
  user?: string;
  ports?: unknown[];
  environment?: Record<string, string>;
  volumes?: { type: string; source: string; target: string; read_only?: boolean }[];
  depends_on?: Record<string, { condition: string }>;
}

interface ComposeConfig {
  services: Record<string, Service>;
}

/** Service du front dans la pile (BF-13) : génération en conteneur durci, site lu par Caddy. */
describe('génération du front : docker/compose.prod.yml', () => {
  let config: ComposeConfig;

  beforeAll(() => {
    const result = spawnSync(
      'docker',
      ['compose', '-f', composeFile, '--profile', 'build', 'config', '--format', 'json'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          SITE_DOMAIN: 'example.test',
          POSTGRES_PASSWORD: 'proprietaire',
          API_DB_PASSWORD: 'lecture',
          CORS_ORIGIN: 'https://example.test',
          WEB_CONTACT_EMAIL: 'contact@example.org',
        },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    config = JSON.parse(result.stdout) as ComposeConfig;
  });

  it('web-build est du profil build : ni `up` ni `up --build` ne le lancent', () => {
    expect(config.services['web-build']?.profiles).toEqual(['build']);
  });

  it('web-build joint l’API sur le réseau interne seulement, jamais la base ni Internet', () => {
    expect(Object.keys(config.services['web-build']?.networks ?? {})).toEqual(['app']);
    expect(config.services['web-build']?.ports ?? []).toEqual([]);
  });

  it('web-build attend une API saine et génère contre elle, avec l’adresse de contact fournie', () => {
    const service = config.services['web-build'];

    expect(service?.depends_on?.['api']?.condition).toBe('service_healthy');
    expect(service?.environment?.['NUXT_CV_SOURCE']).toBe('api');
    expect(service?.environment?.['NUXT_API_BASE_URL']).toBe('http://api:3000');
    expect(service?.environment?.['NUXT_PUBLIC_CONTACT_EMAIL']).toBe('contact@example.org');
    expect(service?.environment?.['NUXT_PUBLIC_I18N_BASE_URL']).toBe('https://example.test');
  });

  it('web-build est durci : lecture seule, capacités retirées, ressources bornées', () => {
    const service = config.services['web-build'];

    expect(service?.read_only).toBe(true);
    expect(service?.cap_drop).toEqual(['ALL']);
    expect(service?.cap_add).toBeUndefined();
    expect(service?.security_opt).toContain('no-new-privileges:true');
    expect(service?.mem_limit).toBeDefined();
    expect(service?.pids_limit).toBeGreaterThan(0);
  });

  it('seul web-build écrit le volume du site, Caddy le lit en lecture seule', () => {
    const volume = (name: string) =>
      config.services[name]?.volumes?.find((entry) => entry.source === 'web_site');

    expect(volume('web-build')?.target).toBe('/site');
    expect(volume('web-build')?.read_only).not.toBe(true);
    expect(volume('caddy')?.target).toBe('/srv/web');
    expect(volume('caddy')?.read_only).toBe(true);
    expect(volume('api')).toBeUndefined();
    expect(volume('postgres')).toBeUndefined();
  });

  it('un `up` sans profil ne contient pas web-build', () => {
    const result = spawnSync('docker', ['compose', '-f', composeFile, 'config', '--services'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SITE_DOMAIN: 'example.test',
        POSTGRES_PASSWORD: 'proprietaire',
        API_DB_PASSWORD: 'lecture',
        CORS_ORIGIN: 'https://example.test',
      },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.split('\n').filter(Boolean).sort()).toEqual([
      'api',
      'caddy',
      'migrate',
      'postgres',
    ]);
  });
});

/** Image de génération : épinglée, sans root, sans secret ni adresse réelle. */
describe('image de génération du front : docker/web.Dockerfile', () => {
  const dockerfile = read('docker/web.Dockerfile');

  it('épingle l’image de base par digest, la même que celle de l’API', () => {
    const arg = /^ARG NODE_IMAGE=(\S+@sha256:[0-9a-f]{64})$/m;

    expect(arg.exec(dockerfile)?.[1]).toBeDefined();
    expect(arg.exec(dockerfile)?.[1]).toBe(arg.exec(read('docker/api.Dockerfile'))?.[1]);
  });

  it('tourne sans privilège et fige les dépendances sur le lockfile', () => {
    expect(dockerfile).toMatch(/^USER node$/m);
    expect(dockerfile).toContain('pnpm install --frozen-lockfile');
    expect(dockerfile).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
  });

  it('exclut du contexte les maquettes, les tests et les sorties de build du front', () => {
    const ignore = read('docker/web.Dockerfile.dockerignore');

    for (const excluded of ['apps/web/design', 'apps/web/.output', 'apps/web/.nuxt']) {
      expect(ignore).toContain(excluded);
    }
    expect(ignore).toMatch(/^\*\*$/m);
  });
});

/** Caddyfile (BF-14) : lu comme du texte, Caddy lui-même est essayé par la pile locale. */
describe('service du front par Caddy : docker/Caddyfile', () => {
  const caddyfile = read('docker/Caddyfile');

  it('sert les fichiers du volume du site, sans le placeholder', () => {
    expect(caddyfile).toContain('root * /srv/web/current/public');
    expect(caddyfile).toContain('try_files {path} {path}/index.html');
    expect(caddyfile).not.toContain('/srv/placeholder');
  });

  it('redirige /fr et /fr/* en 301 sans jamais sortir du site', () => {
    const matcher = /@fr path_regexp fr (\S+)/.exec(caddyfile)?.[1] ?? '';
    const regexp = new RegExp(matcher);

    expect(caddyfile).toContain('redir * /{re.fr.1} permanent');
    expect(regexp.exec('/fr')?.[1]).toBeUndefined();
    expect(regexp.exec('/fr/')?.[1]).toBeUndefined();
    expect(regexp.exec('/fr/accessibilite')?.[1]).toBe('accessibilite');
    expect(regexp.exec('/fr/a/b')?.[1]).toBe('a/b');
    // `/fr//hote` ou `/fr/\hote` donneraient `//hote` : redirection hors du site.
    expect(regexp.test('/fr//hote.test')).toBe(false);
    expect(regexp.test('/fr/\\hote.test')).toBe(false);
    expect(regexp.test('/frais')).toBe(false);
  });

  it('importe la CSP relevée sur la version publiée, pour les pages et la page 404', () => {
    expect(caddyfile.match(/import \/srv\/web\/current\/csp\.\*/g)).toHaveLength(2);
  });

  it('met en cache les fichiers à empreinte (immutable) et fait revalider le reste', () => {
    expect(caddyfile).toContain('@immutable path /_nuxt/*');
    expect(caddyfile).toContain(
      'header @immutable Cache-Control "public, max-age=31536000, immutable"',
    );
    expect(caddyfile).toContain('@revalidate not path /_nuxt/* /fonts/*');
    expect(caddyfile).toContain('header @revalidate Cache-Control "no-cache"');
  });

  it('sert la page 404 du front avec le statut 404', () => {
    expect(caddyfile).toContain('rewrite * /404.html');
    expect(caddyfile).toMatch(/file_server \{\s+status 404\s+\}/);
  });

  it('garde les en-têtes de sécurité de tout le site', () => {
    expect(caddyfile).toContain('Strict-Transport-Security "max-age=31536000; includeSubDomains"');
    expect(caddyfile).toContain('X-Content-Type-Options "nosniff"');
    expect(caddyfile).toContain('Referrer-Policy "no-referrer"');
    expect(caddyfile).toContain('Permissions-Policy "camera=(), microphone=(), geolocation=()"');
  });
});

describe('variables d’environnement du front', () => {
  it.each(['docker/.env.prod.example', 'docker/.env.local.example'])(
    '%s ne porte que le placeholder de l’adresse de contact',
    (path) => {
      const content = read(path);

      expect(content).toMatch(/^WEB_CONTACT_EMAIL=contact@example\.org$/m);
      expect(
        content.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g)?.every((a) => a.endsWith('example.org')),
      ).toBe(true);
    },
  );
});
