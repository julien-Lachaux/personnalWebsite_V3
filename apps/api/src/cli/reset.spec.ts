import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as PathsModule from './paths.js';
import { migrationsDirectory, seedsDirectory } from './paths.js';

const { resetDatabase } = vi.hoisted(() => ({ resetDatabase: vi.fn() }));

vi.mock('../infrastructure/db/reset-database.js', () => ({ resetDatabase }));
vi.mock('./paths.js', async (importOriginal) => ({
  ...(await importOriginal<typeof PathsModule>()),
  databaseUrl: () => 'postgres://u:p@localhost:5432/db',
  log: vi.fn(),
}));

describe('cli/reset', () => {
  afterEach(() => {
    vi.resetModules();
    resetDatabase.mockReset();
    process.exitCode = undefined;
  });

  it('recrée la base de l’environnement puis rejoue migrations et seeds de db/', async () => {
    resetDatabase.mockResolvedValue(undefined);

    await import('./reset.js');

    expect(resetDatabase).toHaveBeenCalledWith({
      databaseUrl: 'postgres://u:p@localhost:5432/db',
      migrationsDirectory,
      seedsDirectory,
      log: expect.any(Function) as unknown,
    });
    expect(process.exitCode).toBeUndefined();
  });
});
