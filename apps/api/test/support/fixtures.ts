import { type Sql } from 'postgres';

import { openTestSql, resetTestDatabase } from './database.js';

/** Préfixe des slugs de fixtures : tout ce qui le porte est supprimé à la fin du test. */
export const FIXTURE_PREFIX = 'qa-';

export interface FixtureOptions {
  /**
   * `true` si la fixture MODIFIE des lignes seedées (published, sort_order, suppression de
   * traductions) : la base est alors recréée (reset + migrations + seeds) en fin de test.
   */
  restoreSeed?: boolean;
}

/** Tables de contenu à vider des lignes `qa-%`, dans un ordre qui respecte les clés étrangères. */
const CONTENT_TABLES = [
  'resources',
  'projects',
  'tools',
  'experiences',
  'certifications',
  'education',
  'languages',
  'social_links',
  'skills',
  'skill_groups',
] as const;

async function deleteFixtureRows(sql: Sql): Promise<void> {
  for (const table of CONTENT_TABLES) {
    await sql`delete from ${sql(table)} where slug like ${`${FIXTURE_PREFIX}%`}`;
  }
}

/**
 * Insère une fixture via une connexion `postgres` brute, exécute `body`, puis nettoie (même en
 * cas d'échec). Les traductions et les `*_skills` partent en cascade avec leur ligne parente.
 *
 * Les slugs de fixtures commencent par `qa-` (voir `FIXTURE_PREFIX`).
 */
export async function withFixture<T>(
  setup: (sql: Sql) => Promise<void>,
  body: (sql: Sql) => Promise<T>,
  options: FixtureOptions = {},
): Promise<T> {
  const sql = openTestSql();
  try {
    await deleteFixtureRows(sql);
    await setup(sql);
    return await body(sql);
  } finally {
    try {
      await deleteFixtureRows(sql);
    } finally {
      await sql.end();
    }
    if (options.restoreSeed) {
      await resetTestDatabase();
    }
  }
}
