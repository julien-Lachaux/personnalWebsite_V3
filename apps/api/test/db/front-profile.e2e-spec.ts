import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runSeeds } from '../../src/infrastructure/db/seeds-runner.js';
import {
  migrationsDirectory,
  openTestSql,
  resetTestDatabase,
  seedsDirectory,
  testDatabaseUrl,
} from '../support/database.js';

const NEW_COLUMNS = [
  'title_badge',
  'taglines',
  'intro',
  'mission',
  'current_activity',
  'seeking_format',
  'seeking_location',
  'seeking_availability',
  'cv_path',
] as const;

/**
 * BF-1 (brief back-001) : colonnes du profil pour le design v6, ajoutées à profile_translations.
 * Les anciennes colonnes (headline, bio, availability) restent jusqu'à la bascule de l'API.
 */
describe('profil restructuré (BF-1)', () => {
  let sql: Sql;
  let workDirectory: string;

  const run = (directory: string) =>
    runSeeds({
      databaseUrl: testDatabaseUrl(),
      directory,
      migrationsDirectory,
      log: () => undefined,
    });

  async function seedsPlus(statement: string): Promise<string> {
    const directory = join(workDirectory, 'seeds');
    await rm(directory, { recursive: true, force: true });
    await cp(seedsDirectory, directory, { recursive: true });
    await writeFile(join(directory, '0099_en_lacunaire.sql'), statement);
    return directory;
  }

  beforeAll(() => {
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await resetTestDatabase();
    workDirectory = await mkdtemp(join(tmpdir(), 'siteperso-front-profile-'));
    return async () => {
      await rm(workDirectory, { recursive: true, force: true });
    };
  });

  it('ajoute les neuf colonnes, de type text (taglines : text[]), et garde les anciennes', async () => {
    const rows = await sql<{ column_name: string; type: string }[]>`
      select c.column_name, format_type(a.atttypid, a.atttypmod) as type
      from information_schema.columns c
      join pg_attribute a on a.attrelid = 'profile_translations'::regclass and a.attname = c.column_name
      where c.table_schema = 'public' and c.table_name = 'profile_translations'`;
    const types = new Map(rows.map((row) => [row.column_name, row.type]));

    for (const column of NEW_COLUMNS) {
      expect(types.get(column)).toBe(column === 'taglines' ? 'text[]' : 'text');
    }
    for (const column of ['headline', 'bio', 'availability']) {
      expect(types.get(column)).toBe('text');
    }
  });

  it('seede les neuf colonnes, non vides, dans les deux langues', async () => {
    const rows = await sql<Record<string, string | string[] | null>[]>`
      select locale, title, title_badge, taglines, intro, mission, current_activity,
        seeking_format, seeking_location, seeking_availability, cv_path
      from profile_translations order by locale`;

    expect(rows.map((row) => row['locale'])).toEqual(['en', 'fr']);
    for (const row of rows) {
      for (const column of NEW_COLUMNS) {
        const value = row[column];
        expect({
          locale: row['locale'],
          column,
          empty: value == null || value.length === 0,
        }).toEqual({ locale: row['locale'], column, empty: false });
      }
      expect(row['taglines']).toHaveLength(2);
      expect(row['title_badge']).toBe('senior');
    }
  });

  it('seede le titre « Développeur full-stack » et le chemin du CV de chaque langue', async () => {
    const rows = await sql<{ locale: string; title: string; cv_path: string }[]>`
      select locale, title, cv_path from profile_translations order by locale`;

    expect(rows).toEqual([
      { locale: 'en', title: 'Full-stack developer', cv_path: '/cv/cv-en.pdf' },
      { locale: 'fr', title: 'Développeur full-stack', cv_path: '/cv/cv-fr.pdf' },
    ]);
  });

  it('seede le texte français du handoff (accroches, recherche)', async () => {
    const [row] = await sql<
      { taglines: string[]; seeking_format: string; seeking_availability: string }[]
    >`
      select taglines, seeking_format, seeking_availability
      from profile_translations where locale = 'fr'`;

    expect(row?.taglines).toEqual([
      'NestJS, Vue.js — données, ETL et analytics',
      'Développement assisté par IA et agentique',
    ]);
    expect(row?.seeking_format).toBe(
      'Temps partiel (3 jours par semaine) ou missions freelance courtes',
    );
    expect(row?.seeking_availability).toBe('Immédiate');
  });

  it('refuse une traduction en dont une nouvelle colonne est nulle (complétude), sans rien appliquer', async () => {
    const directory = await seedsPlus(
      `update profile_translations set seeking_location = null where locale = 'en';`,
    );

    await expect(run(directory)).rejects.toThrow(
      /Traduction en incomplète.*profile\/profil \(seeking_location\)/,
    );
  });

  it('refuse une traduction en dont taglines est un tableau vide', async () => {
    const directory = await seedsPlus(
      `update profile_translations set taglines = '{}'::text[] where locale = 'en';`,
    );

    await expect(run(directory)).rejects.toThrow(
      /Traduction en incomplète.*profile\/profil \(taglines\)/,
    );
  });
});
