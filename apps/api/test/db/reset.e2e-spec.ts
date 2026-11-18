import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetDatabase } from '../../src/infrastructure/db/reset-database.js';
import { resetTestDatabase, testDatabaseUrl } from '../support/database.js';

describe('reset de la base', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('recrée le schéma, rejoue migrations et seeds, et laisse la base migrée', async () => {
    await resetTestDatabase();
    // Deux resets de suite ne laissent aucune trace de l'état précédent.
    await expect(resetTestDatabase()).resolves.toBeUndefined();
  });

  it('refuse de s’exécuter avec NODE_ENV=production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    await expect(
      resetDatabase({
        databaseUrl: testDatabaseUrl(),
        migrationsDirectory: '/inexistant',
        seedsDirectory: '/inexistant',
        log: () => undefined,
      }),
    ).rejects.toThrow(/refusé en production/);
  });
});
