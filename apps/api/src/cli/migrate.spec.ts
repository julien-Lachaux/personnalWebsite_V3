import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as PathsModule from './paths.js';
import { migrationsDirectory } from './paths.js';

const { runMigrations } = vi.hoisted(() => ({ runMigrations: vi.fn() }));

vi.mock('../infrastructure/db/migrations-runner.js', () => ({ runMigrations }));
vi.mock('./paths.js', async (importOriginal) => ({
  ...(await importOriginal<typeof PathsModule>()),
  databaseUrl: () => 'postgres://u:p@localhost:5432/db',
  log: vi.fn(),
}));

describe('cli/migrate', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    runMigrations.mockReset();
    process.exitCode = undefined;
  });

  it('applique les migrations de db/migrations sur la base de l’environnement', async () => {
    runMigrations.mockResolvedValue({ applied: [], alreadyApplied: [] });

    await import('./migrate.js');

    expect(runMigrations).toHaveBeenCalledWith({
      databaseUrl: 'postgres://u:p@localhost:5432/db',
      directory: migrationsDirectory,
      log: expect.any(Function) as unknown,
    });
    expect(process.exitCode).toBeUndefined();
  });

  it('signale l’échec sur stderr et sort en code 1', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    runMigrations.mockRejectedValue(new Error('Erreur de checksum : 0001_enums.sql'));

    await import('./migrate.js');

    expect(stderr).toHaveBeenCalledWith('Erreur : Erreur de checksum : 0001_enums.sql\n');
    expect(process.exitCode).toBe(1);
  });
});
