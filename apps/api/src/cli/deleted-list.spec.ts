import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as PathsModule from './paths.js';

const { listDeletedEntities } = vi.hoisted(() => ({ listDeletedEntities: vi.fn() }));

vi.mock('../infrastructure/db/deleted-entities.js', () => ({ listDeletedEntities }));
vi.mock('./paths.js', async (importOriginal) => ({
  ...(await importOriginal<typeof PathsModule>()),
  databaseUrl: () => 'postgres://u:p@localhost:5432/db',
  log: vi.fn(),
}));

describe('cli/deleted-list', () => {
  afterEach(() => {
    vi.resetModules();
    listDeletedEntities.mockReset();
    process.exitCode = undefined;
  });

  it('liste les entités marquées supprimées de la base de l’environnement', async () => {
    listDeletedEntities.mockResolvedValue([]);

    await import('./deleted-list.js');

    expect(listDeletedEntities).toHaveBeenCalledWith({
      databaseUrl: 'postgres://u:p@localhost:5432/db',
      log: expect.any(Function) as unknown,
    });
    expect(process.exitCode).toBeUndefined();
  });

  it('sort en code 1 avec le message d’erreur si la base est injoignable', async () => {
    listDeletedEntities.mockRejectedValue(new Error('base injoignable'));
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await import('./deleted-list.js');

    expect(stderr).toHaveBeenCalledWith('Erreur : base injoignable\n');
    expect(process.exitCode).toBe(1);
    stderr.mockRestore();
  });
});
