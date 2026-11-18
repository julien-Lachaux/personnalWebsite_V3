import { fileURLToPath } from 'node:url';

import postgres, { type Sql } from 'postgres';

import { resetDatabase } from '../../src/infrastructure/db/reset-database.js';

/** Racine du dépôt, depuis `apps/api/test/support/`. */
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export const migrationsDirectory = `${repositoryRoot}db/migrations`;
export const seedsDirectory = `${repositoryRoot}db/seeds`;

/** URL de la base de test (`DATABASE_URL` posé par `vitest.e2e.config.ts`). */
export function testDatabaseUrl(): string {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL absent : les e2e se lancent avec vitest.e2e.config.ts.');
  }
  return url;
}

/** Recrée la base de test : schéma vidé, migrations puis seeds (même séquence que `db:reset`). */
export async function resetTestDatabase(): Promise<void> {
  await resetDatabase({
    databaseUrl: testDatabaseUrl(),
    migrationsDirectory,
    seedsDirectory,
    log: () => undefined,
  });
}

/** Connexion `postgres` brute sur la base de test, pour les fixtures. À fermer avec `end()`. */
export function openTestSql(): Sql {
  return postgres(testDatabaseUrl(), { max: 2, onnotice: () => undefined });
}
