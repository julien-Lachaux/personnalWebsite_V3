import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runSeeds } from '../../src/infrastructure/db/seeds-runner.js';
import {
  migrationsDirectory,
  openTestSql,
  resetTestDatabase,
  seedsDirectory,
  testDatabaseUrl,
} from '../support/database.js';

/** Entités publiables : table, table de traduction et colonne de clé étrangère. */
const TRANSLATED = [
  ['social_links', 'social_links_translations', 'social_link_id'],
  ['skill_groups', 'skill_groups_translations', 'skill_group_id'],
  ['skills', 'skills_translations', 'skill_id'],
  ['experiences', 'experiences_translations', 'experience_id'],
  ['projects', 'projects_translations', 'project_id'],
  ['tools', 'tools_translations', 'tool_id'],
  ['resources', 'resources_translations', 'resource_id'],
  ['certifications', 'certifications_translations', 'certification_id'],
  ['education', 'education_translations', 'education_id'],
  ['languages', 'languages_translations', 'language_id'],
] as const;

// Mêmes motifs que le critère D7 du backlog (e-mail, numéro de téléphone français).
const EMAIL_PATTERN = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[a-z]{2,}';
const PHONE_PATTERN = '(\\+33|0)[1-9]([ .-]?[0-9]{2}){4}';

async function tableNames(sql: Sql): Promise<string[]> {
  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name <> 'schema_migrations' order by 1`;
  return rows.map((row) => row.table_name);
}

async function countRows(sql: Sql, tables: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count from ${sql(table)}`;
    counts[table] = rows[0]?.count ?? 0;
  }
  return counts;
}

describe('seeds SQL (base de test)', () => {
  let sql: Sql;

  beforeAll(async () => {
    await resetTestDatabase();
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it('sont idempotents : un second passage ne change aucun comptage', async () => {
    const tables = await tableNames(sql);
    const before = await countRows(sql, tables);

    await runSeeds({
      databaseUrl: testDatabaseUrl(),
      directory: seedsDirectory,
      migrationsDirectory,
      log: () => undefined,
    });

    expect(await countRows(sql, tables)).toEqual(before);
    expect(before['experiences']).toBe(8);
    expect(before['profile']).toBe(1);
  });

  it('donnent une traduction fr à chaque entité publiée', async () => {
    for (const [table, translations, fk] of TRANSLATED) {
      const rows = await sql<{ count: number }[]>`
        select count(*)::int as count from ${sql(table)} t
        where t.published and not exists (
          select 1 from ${sql(translations)} tr where tr.${sql(fk)} = t.id and tr.locale = 'fr')`;
      expect({ table, missing: rows[0]?.count }).toEqual({ table, missing: 0 });
    }
    const profile = await sql<{ count: number }[]>`
      select count(*)::int as count from profile_translations where locale = 'fr'`;
    expect(profile[0]?.count).toBe(1);
  });

  it('fournissent un texte alternatif pour toute image', async () => {
    const profile = await sql`
      select 1 from profile p join profile_translations t on t.profile_id = p.id
      where trim(t.picture_alt) = ''`;
    expect(profile).toHaveLength(0);

    const logos = await sql`
      select e.slug, t.locale from experiences e
      join experiences_translations t on t.experience_id = e.id
      where e.logo_path is not null and (t.logo_alt is null or trim(t.logo_alt) = '')`;
    expect(logos).toHaveLength(0);

    const projects = await sql`
      select p.slug from projects p
      join projects_translations t on t.project_id = p.id
      where (p.image_desktop_path is not null or p.image_mobile_path is not null)
        and (t.image_alt is null or trim(t.image_alt) = '')`;
    expect(projects).toHaveLength(0);

    const resources = await sql`
      select r.slug from resources r
      join resources_translations t on t.resource_id = r.id
      where r.picture_path is not null and (t.picture_alt is null or trim(t.picture_alt) = '')`;
    expect(resources).toHaveLength(0);
  });

  it('ne contiennent ni e-mail ni numéro de téléphone', async () => {
    const columns = await sql<{ table_name: string; column_name: string; data_type: string }[]>`
      select table_name, column_name, data_type from information_schema.columns
      where table_schema = 'public' and table_name <> 'schema_migrations'
        and data_type in ('text', 'ARRAY')`;
    expect(columns.length).toBeGreaterThan(0);

    for (const { table_name: table, column_name: column, data_type: type } of columns) {
      const expression =
        type === 'ARRAY' ? sql`array_to_string(${sql(column)}, ' ')` : sql`${sql(column)}`;
      const rows = await sql<{ count: number }[]>`
        select count(*)::int as count from ${sql(table)}
        where ${expression} ~* ${EMAIL_PATTERN} or ${expression} ~ ${PHONE_PATTERN}`;
      expect({ table, column, matches: rows[0]?.count }).toEqual({ table, column, matches: 0 });
    }
  });

  it('ne contiennent que des URL en https://', async () => {
    const columns = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public' and data_type = 'text'
        and (column_name = 'url' or column_name like '%\\_url')`;
    expect(columns.length).toBeGreaterThan(0);

    for (const { table_name: table, column_name: column } of columns) {
      const rows = await sql<{ count: number }[]>`
        select count(*)::int as count from ${sql(table)}
        where ${sql(column)} is not null and ${sql(column)} not like 'https://%'`;
      expect({ table, column, invalid: rows[0]?.count }).toEqual({ table, column, invalid: 0 });
    }
  });
});
