import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../../scripts/deploy/vps-stack.sh', import.meta.url));
const repository = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Garde-fou de la pile d'essai (lot 29, revue de la PR #24) : `vps-stack.sh` supprime volumes et dossier du
 * socket (`down`) d'après le fichier d'environnement. Il refuse d'agir sur un fichier qui n'est pas d'essai :
 * projet compose sans `-vps`, dossier hors de `${TMPDIR}/siteperso-vps-run.*`, ou chemin qui remonte (`..`,
 * `/`). Tout est joué en `DRY_RUN=1` : aucune commande conteneur n'est lancée.
 */
describe('vps-stack.sh : refus d’un fichier d’environnement qui n’est pas d’essai', () => {
  let work: string;

  beforeAll(async () => {
    work = await mkdtemp(join(tmpdir(), 'siteperso-vps-guard-'));
  });

  afterAll(async () => {
    await rm(work, { recursive: true, force: true });
  });

  async function down(name: string, project: string, runDirectory: string) {
    const envFile = join(work, name);
    await writeFile(envFile, `COMPOSE_PROJECT_NAME=${project}\nPROD_RUN_DIR=${runDirectory}\n`);
    return spawnSync('bash', [script, 'down'], {
      encoding: 'utf8',
      cwd: repository,
      // stdin fermé : un bash dont l'entrée est une socket lit /etc/bashrc (voir la mémoire du poste).
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VPS_STACK_ENV_FILE: envFile, DRY_RUN: '1', TMPDIR: '/tmp' },
    });
  }

  it.each([
    ['projet sans -vps', 'siteperso-v3-prod', '/tmp/siteperso-vps-run.abc', 'projet'],
    ['dossier hors du préfixe', 'essai-vps', '/srv/apps/site-perso', 'dossier du socket'],
    ['remontée par ..', 'essai-vps', '/tmp/siteperso-vps-run.x/../../home/x', 'dossier du socket'],
    ['sous-dossier', 'essai-vps', '/tmp/siteperso-vps-run.x/y', 'dossier du socket'],
    ['préfixe seul', 'essai-vps', '/tmp/siteperso-vps-run.', 'dossier du socket'],
  ])('refuse : %s', async (_case, project, runDirectory, reason) => {
    const result = await down(`refus-${project}-${runDirectory.length}`, project, runDirectory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(reason);
    expect(result.stderr).toContain('refusé');
    expect(result.stdout).not.toContain('(dry-run)');
  });

  it('accepte un fichier d’essai et n’annonce que la commande (dry-run)', async () => {
    const result = await down('essai', 'essai-vps', '/tmp/siteperso-vps-run.abc123');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('(dry-run)');
    expect(result.stdout).toContain('down --remove-orphans --volumes');
  });
});
