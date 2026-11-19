import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../../scripts/deploy/local-stack.sh', import.meta.url));

describe('scripts/deploy/local-stack.sh (pnpm stack:*)', () => {
  let directory: string;
  let envFile: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'siteperso-stack-'));
    envFile = join(directory, '.env.local');
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  function stack(args: string[], extraEnv: Record<string, string> = {}) {
    return spawnSync('bash', [script, ...args], {
      encoding: 'utf8',
      env: { ...process.env, DRY_RUN: '1', STACK_ENV_FILE: envFile, ...extraEnv },
    });
  }

  it.each([[[]], [['inconnue']], [['up-all']]])('refuse la commande %j avec le code 2', (args) => {
    const result = stack(args);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage');
  });

  it('down n’accepte que l’option explicite --volumes', () => {
    const result = stack(['down', '-v']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('seule --volumes est acceptée');
  });

  it('down sans option ne supprime pas les volumes ; --volumes les supprime', () => {
    const plain = stack(['down']);
    const withVolumes = stack(['down', '--volumes']);

    expect(plain.status).toBe(0);
    expect(plain.stdout).toMatch(/down --remove-orphans\s*$/);
    expect(withVolumes.status).toBe(0);
    expect(withVolumes.stdout).toMatch(/down --remove-orphans --volumes\s*$/);
  });

  it('up affiche, en simulation, la commande compose de production et l’attente de santé', () => {
    const result = stack(['up']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('docker/compose.prod.yml');
    expect(result.stdout).toContain(`--env-file ${envFile} up -d --build`);
    expect(result.stdout).toContain('attendrait /api/v1/health');
  });

  it('génère un fichier d’environnement local aux mots de passe propres, en droits 600', () => {
    const result = spawnSync('bash', [script, 'ps'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}:${process.env['PATH'] ?? ''}`,
        STACK_ENV_FILE: envFile,
      },
    });

    // `docker compose ps` échoue ou non selon l'hôte : seule la création du fichier est vérifiée ici.
    expect(result.stdout).toContain('mots de passe générés');
    return Promise.all([readFile(envFile, 'utf8'), stat(envFile)]).then(([content, info]) => {
      expect(content).toMatch(/^POSTGRES_PASSWORD=[0-9a-f]{48}$/m);
      expect(content).toMatch(/^API_DB_PASSWORD=[0-9a-f]{48}$/m);
      expect(content).not.toContain('__GENERE__');
      expect(content).toContain('COMPOSE_PROJECT_NAME=siteperso-v3-local');
      expect(info.mode & 0o777).toBe(0o600);
    });
  });
});
