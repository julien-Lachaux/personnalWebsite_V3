import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as PathsModule from './paths.js';
import { migrationsDirectory, seedsDirectory } from './paths.js';

const { runSeeds } = vi.hoisted(() => ({ runSeeds: vi.fn() }));

vi.mock('../infrastructure/db/seeds-runner.js', () => ({ runSeeds }));
vi.mock('./paths.js', async (importOriginal) => ({
  ...(await importOriginal<typeof PathsModule>()),
  databaseUrl: () => 'postgres://u:p@localhost:5432/db',
  log: vi.fn(),
}));

describe('cli/seed', () => {
  afterEach(() => {
    vi.resetModules();
    runSeeds.mockReset();
    process.exitCode = undefined;
  });

  it('rejoue les seeds de db/seeds en contrôlant les migrations de db/migrations', async () => {
    runSeeds.mockResolvedValue([]);

    await import('./seed.js');

    expect(runSeeds).toHaveBeenCalledWith({
      databaseUrl: 'postgres://u:p@localhost:5432/db',
      directory: seedsDirectory,
      migrationsDirectory,
      log: expect.any(Function) as unknown,
    });
    expect(process.exitCode).toBeUndefined();
  });
});
