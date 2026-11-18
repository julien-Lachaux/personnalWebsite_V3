import { openTestSql } from './database.js';

/** Tables de contenu (hors `schema_migrations`) : tout ce que les seeds remplissent. */
const CONTENT_TABLES = [
  'profile',
  'social_links',
  'skill_groups',
  'skills',
  'experiences',
  'projects',
  'tools',
  'resources',
  'certifications',
  'education',
  'languages',
] as const;

/**
 * Base migrée mais VIDE : schéma intact, aucune ligne de contenu (les traductions et les tables
 * de liaison partent en cascade). À suivre d'un `resetTestDatabase()` pour rendre la base seedée.
 */
export async function emptyTestDatabase(): Promise<void> {
  const sql = openTestSql();
  try {
    // Liste constante ci-dessus : aucune valeur externe dans la requête.
    await sql.unsafe(`truncate table ${CONTENT_TABLES.join(', ')} restart identity cascade`);
  } finally {
    await sql.end();
  }
}
