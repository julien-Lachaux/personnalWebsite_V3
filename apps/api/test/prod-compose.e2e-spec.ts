import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const composeFile = fileURLToPath(new URL('../../../docker/compose.prod.yml', import.meta.url));

interface Service {
  networks?: Record<string, unknown>;
  read_only?: boolean;
  cap_drop?: string[];
  security_opt?: string[];
  mem_limit?: string | number;
  pids_limit?: number;
  environment?: Record<string, string>;
}

interface ComposeConfig {
  services: Record<string, Service>;
  networks: Record<string, { internal?: boolean }>;
}

/** Garde-fous de la pile de production (RS-1, RS-5, RS-7) : la configuration résolue par compose. */
describe('pile de production (docker/compose.prod.yml)', () => {
  let config: ComposeConfig;

  beforeAll(() => {
    const result = spawnSync(
      'docker',
      ['compose', '-f', composeFile, 'config', '--format', 'json'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          SITE_DOMAIN: 'example.test',
          POSTGRES_PASSWORD: 'proprietaire',
          API_DB_PASSWORD: 'lecture',
          CORS_ORIGIN: 'https://example.test',
        },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    config = JSON.parse(result.stdout) as ComposeConfig;
  });

  const networksOf = (service: string) => Object.keys(config.services[service]?.networks ?? {});

  it('sépare les réseaux : Caddy ne joint pas la base, l’API ne sort pas sur Internet', () => {
    expect(config.networks['app']?.internal).toBe(true);
    expect(config.networks['data']?.internal).toBe(true);
    expect(config.networks['edge']?.internal).not.toBe(true);

    expect(networksOf('caddy').sort()).toEqual(['app', 'edge']);
    expect(networksOf('api').sort()).toEqual(['app', 'data']);
    expect(networksOf('migrate')).toEqual(['data']);
    expect(networksOf('postgres')).toEqual(['data']);
  });

  it.each(['caddy', 'api', 'migrate', 'postgres'])(
    '%s : système de fichiers en lecture seule, capacités retirées, no-new-privileges, ressources bornées',
    (name) => {
      const service = config.services[name];

      expect(service?.read_only).toBe(true);
      expect(service?.cap_drop).toEqual(['ALL']);
      expect(service?.security_opt).toContain('no-new-privileges:true');
      expect(service?.mem_limit).toBeDefined();
      expect(service?.pids_limit).toBeGreaterThan(0);
    },
  );

  it('l’API se connecte avec le rôle de lecture seule, seul migrate a le rôle propriétaire', () => {
    expect(config.services['api']?.environment?.['DATABASE_URL']).toContain('//siteperso_api:');
    expect(config.services['migrate']?.environment?.['DATABASE_URL']).toContain('//siteperso:');
  });

  it('ne fait confiance qu’aux proxys du réseau privé, jamais à tous les sauts', () => {
    expect(config.services['api']?.environment?.['TRUST_PROXY']).toBe('uniquelocal');
  });
});
