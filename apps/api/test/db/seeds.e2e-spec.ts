import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Sql } from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

/** Empreinte md5 du contenu de chaque table (lignes triées), pour comparer deux états de la base. */
async function snapshot(sql: Sql, tables: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const table of tables) {
    const rows = await sql<{ hash: string }[]>`
      select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as hash
      from ${sql(table)} t`;
    result[table] = rows[0]?.hash ?? '';
  }
  return result;
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

  it('sont idempotents : un second passage laisse le contenu de chaque table identique (md5)', async () => {
    const tables = await tableNames(sql);
    const before = await snapshot(sql, tables);

    await runSeeds({
      databaseUrl: testDatabaseUrl(),
      directory: seedsDirectory,
      migrationsDirectory,
      log: () => undefined,
    });

    expect(await snapshot(sql, tables)).toEqual(before);
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

describe('convergence de la base vers les seeds', () => {
  let sql: Sql;
  let workDirectory: string;
  const run = (directory: string, log: (line: string) => void = () => undefined) =>
    runSeeds({ databaseUrl: testDatabaseUrl(), directory, migrationsDirectory, log });

  /** Copie les seeds dans un dossier temporaire en appliquant `edit` au contenu d'un fichier. */
  async function seedsWith(file: string, edit: (content: string) => string): Promise<string> {
    const directory = join(workDirectory, 'seeds');
    await rm(directory, { recursive: true, force: true });
    await cp(seedsDirectory, directory, { recursive: true });
    const path = join(directory, file);
    await writeFile(path, edit(await readFile(path, 'utf8')));
    return directory;
  }

  beforeEach(async () => {
    await resetTestDatabase();
    sql = openTestSql();
    workDirectory = await mkdtemp(join(tmpdir(), 'siteperso-seeds-'));
  });

  afterEach(async () => {
    await sql.end({ timeout: 5 });
    await rm(workDirectory, { recursive: true, force: true });
  });

  it('supprime une liaison compétence ajoutée à la main et absente des seeds', async () => {
    await sql`
      insert into experience_skills (experience_id, skill_id)
      select e.id, s.id from experiences e, skills s where e.slug = 'nopillo' and s.slug = 'php'`;

    const lines: string[] = [];
    await run(seedsDirectory, (line) => lines.push(line));

    const rows = await sql`
      select 1 from experience_skills es
      join experiences e on e.id = es.experience_id join skills s on s.id = es.skill_id
      where e.slug = 'nopillo' and s.slug = 'php'`;
    expect(rows).toHaveLength(0);
    expect(lines.join('\n')).toContain('experience_skills : 1 ligne(s) absente(s) des seeds');
  });

  it('supprime une liaison et une traduction retirées d’un fichier de seed', async () => {
    const directory = await seedsWith('0004_experiences.sql', (content) =>
      content
        .replace("  ('nopillo', 'docker', 6),\n", '')
        .replace(
          /insert into experiences_translations[^;]*'en',\s*'Senior Software Engineer'[\s\S]*?where p\.slug = 'nopillo'\s*on conflict[^;]*;/,
          '',
        ),
    );

    await run(directory);

    const links = await sql`
      select 1 from experience_skills es join experiences e on e.id = es.experience_id
      join skills s on s.id = es.skill_id where e.slug = 'nopillo' and s.slug = 'docker'`;
    expect(links).toHaveLength(0);
    const translations = await sql<{ locale: string }[]>`
      select locale from experiences_translations t join experiences e on e.id = t.experience_id
      where e.slug = 'nopillo' order by 1`;
    expect(translations.map((row) => row.locale)).toEqual(['fr']);
  });

  it('refuse une instruction de seed qui ne touche aucune ligne (slug inconnu) et ne change rien', async () => {
    const tables = await tableNames(sql);
    const before = await snapshot(sql, tables);
    const broken = await seedsWith('0002_social_links.sql', (content) =>
      content.replaceAll("where p.slug = 'linkedin'", "where p.slug = 'linkedinn'"),
    );

    await expect(run(broken)).rejects.toThrow(
      /0002_social_links : une instruction n'a touché aucune ligne/,
    );
    expect(await snapshot(sql, tables)).toEqual(before);
  });

  it('refuse un slug inconnu dans une liste de liaisons, même si les autres lignes existent', async () => {
    const tables = await tableNames(sql);
    const before = await snapshot(sql, tables);
    const broken = await seedsWith('0004_experiences.sql', (content) =>
      content.replace("('nopillo', 'elysia', 2)", "('nopillo', 'elysiaa', 2)"),
    );

    await expect(run(broken)).rejects.toThrow(/null value|not-null/i);
    expect(await snapshot(sql, tables)).toEqual(before);
  });

  it('signale sans la supprimer une entité absente des seeds', async () => {
    await sql`
      insert into certifications (slug, issuer, year) values ('qa-retiree', 'Organisme', 2020)`;

    const lines: string[] = [];
    await run(seedsDirectory, (line) => lines.push(line));

    expect(
      lines.some(
        (line) => line.includes('ATTENTION certifications') && line.includes('qa-retiree'),
      ),
    ).toBe(true);
    const rows = await sql`select 1 from certifications where slug = 'qa-retiree'`;
    expect(rows).toHaveLength(1);
  });

  it('ne touche pas aux tables que les seeds ne mentionnent pas (projets sans seed)', async () => {
    await sql`insert into projects (slug) values ('qa-projet-main')`;
    await sql`
      insert into projects_translations (project_id, locale, title, description)
      select id, 'fr', 'Projet', 'Description' from projects where slug = 'qa-projet-main'`;

    await run(seedsDirectory);

    const rows = await sql`select 1 from projects_translations`;
    expect(rows).toHaveLength(1);
  });
});
