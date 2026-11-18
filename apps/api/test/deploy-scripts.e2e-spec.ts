import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const scriptsDirectory = fileURLToPath(new URL('../../../scripts/deploy/', import.meta.url));

describe('scripts de déploiement', () => {
  let deployDirectory: string;

  beforeAll(async () => {
    deployDirectory = await mkdtemp(join(tmpdir(), 'siteperso-deploy-'));
    await writeFile(join(deployDirectory, '.env.prod'), 'SITE_DOMAIN=example.test\n');
  });

  afterAll(async () => {
    await rm(deployDirectory, { recursive: true, force: true });
  });

  function backup(keep: string) {
    return spawnSync('bash', [join(scriptsDirectory, 'backup.sh')], {
      encoding: 'utf8',
      env: { ...process.env, DRY_RUN: '1', DEPLOY_DIR: deployDirectory, BACKUP_KEEP: keep },
    });
  }

  it.each(['0', '-1', 'abc', '1.5'])(
    'backup.sh refuse BACKUP_KEEP=%j (0 supprimerait toutes les sauvegardes)',
    (keep) => {
      const result = backup(keep);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('BACKUP_KEEP doit être un entier >= 1');
    },
  );

  it.each(['1', '14', '100'])('backup.sh accepte BACKUP_KEEP=%s', (keep) => {
    expect(backup(keep).status).toBe(0);
  });

  it('update.sh sauvegarde la base avant de toucher au code, sauf SKIP_BACKUP=1', () => {
    const run = (extra: Record<string, string>) =>
      spawnSync('bash', [join(scriptsDirectory, 'update.sh')], {
        encoding: 'utf8',
        env: { ...process.env, DRY_RUN: '1', DEPLOY_DIR: deployDirectory, ...extra },
      });

    const withBackup = run({});
    const withoutBackup = run({ SKIP_BACKUP: '1' });

    expect(withBackup.status).toBe(0);
    expect(withBackup.stdout.indexOf('Sauvegarde préalable de la base')).toBeGreaterThanOrEqual(0);
    expect(withBackup.stdout.indexOf('Sauvegarde préalable')).toBeLessThan(
      withBackup.stdout.indexOf('Mise à jour du code'),
    );
    expect(withoutBackup.stdout).toContain('Sauvegarde préalable ignorée');
    expect(withoutBackup.stdout).not.toContain('Sauvegarde vers');
  });
});
