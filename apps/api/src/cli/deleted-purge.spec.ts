import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as PathsModule from './paths.js';

const { purgeDeletedEntities } = vi.hoisted(() => ({ purgeDeletedEntities: vi.fn() }));

vi.mock('../infrastructure/db/deleted-entities.js', () => ({ purgeDeletedEntities }));
vi.mock('./paths.js', async (importOriginal) => ({
  ...(await importOriginal<typeof PathsModule>()),
  databaseUrl: () => 'postgres://u:p@localhost:5432/db',
  log: vi.fn(),
}));

describe('cli/deleted-purge', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    purgeDeletedEntities.mockResolvedValue(0);
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.resetModules();
    purgeDeletedEntities.mockReset();
    process.exitCode = undefined;
  });

  it('transmet --older-than et --confirm à la purge', async () => {
    process.argv = ['node', 'deleted-purge.ts', '--older-than', '30', '--confirm'];

    await import('./deleted-purge.js');

    expect(purgeDeletedEntities).toHaveBeenCalledWith({
      databaseUrl: 'postgres://u:p@localhost:5432/db',
      olderThanDays: 30,
      confirm: true,
      log: expect.any(Function) as unknown,
    });
    expect(process.exitCode).toBeUndefined();
  });

  it('sans --confirm, la purge est demandée en simulation', async () => {
    process.argv = ['node', 'deleted-purge.ts', '--older-than', '7'];

    await import('./deleted-purge.js');

    expect(purgeDeletedEntities).toHaveBeenCalledWith(
      expect.objectContaining({ olderThanDays: 7, confirm: false }),
    );
  });

  it('sans --older-than : message d’erreur, code 1, aucune purge', async () => {
    process.argv = ['node', 'deleted-purge.ts', '--confirm'];
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await import('./deleted-purge.js');

    expect(purgeDeletedEntities).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('--older-than <jours>'));
    expect(process.exitCode).toBe(1);
    stderr.mockRestore();
  });
});
