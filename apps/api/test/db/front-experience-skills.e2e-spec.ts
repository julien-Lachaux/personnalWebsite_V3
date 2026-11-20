import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

/** Liens issus des mots-clés de recherche, non affichés dans la stack (BF-2). */
const HIDDEN_LINKS = [
  'afluens/rest-api',
  'contentsquare/adobe-analytics',
  'contentsquare/google-analytics',
  'contentsquare/production-operations',
  'nopillo/agentic-development',
  'nopillo/ocr',
  'wynd-integration/production-operations',
  'wynd-integration/rest-api',
];

/** BF-2 (brief back-001) : experience_skills.shown_in_stack. */
describe('liens expérience ↔ compétence cachés (BF-2)', () => {
  let sql: Sql;
  let workDirectory: string;

  beforeAll(() => {
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await resetTestDatabase();
    workDirectory = await mkdtemp(join(tmpdir(), 'siteperso-front-links-'));
    return async () => {
      await rm(workDirectory, { recursive: true, force: true });
    };
  });

  it('déclare shown_in_stack booléen, non nul, à true par défaut', async () => {
    const [column] = await sql<
      { is_nullable: string; column_default: string; data_type: string }[]
    >`
      select is_nullable, column_default, data_type from information_schema.columns
      where table_name = 'experience_skills' and column_name = 'shown_in_stack'`;

    expect(column).toEqual({ is_nullable: 'NO', column_default: 'true', data_type: 'boolean' });
  });

  it('refuse un shown_in_stack nul et met true quand la colonne est omise', async () => {
    await expect(sql`
      insert into experience_skills (experience_id, skill_id, shown_in_stack)
      select e.id, s.id, null from experiences e, skills s
      where e.slug = 'leboncoin' and s.slug = 'docker'`).rejects.toThrow(/shown_in_stack/);

    await sql`
      insert into experience_skills (experience_id, skill_id)
      select e.id, s.id from experiences e, skills s where e.slug = 'leboncoin' and s.slug = 'docker'`;
    const [row] = await sql<{ shown_in_stack: boolean }[]>`
      select es.shown_in_stack from experience_skills es
      join experiences e on e.id = es.experience_id join skills s on s.id = es.skill_id
      where e.slug = 'leboncoin' and s.slug = 'docker'`;
    expect(row?.shown_in_stack).toBe(true);
  });

  it('seede exactement les huit liens cachés du brief, tous les autres sont affichés', async () => {
    const hidden = await sql<{ link: string }[]>`
      select e.slug || '/' || s.slug as link from experience_skills es
      join experiences e on e.id = es.experience_id join skills s on s.id = es.skill_id
      where not es.shown_in_stack order by 1`;
    const [shown] = await sql<{ count: number }[]>`
      select count(*)::int as count from experience_skills where shown_in_stack`;

    expect(hidden.map((row) => row.link)).toEqual(HIDDEN_LINKS);
    expect(shown?.count).toBe(37);
  });

  it('place les liens cachés après les puces de leur expérience', async () => {
    const rows = await sql<{ experience: string; hidden_min: number; shown_max: number }[]>`
      select e.slug as experience,
        min(es.sort_order) filter (where not es.shown_in_stack)::int as hidden_min,
        max(es.sort_order) filter (where es.shown_in_stack)::int as shown_max
      from experience_skills es join experiences e on e.id = es.experience_id
      group by e.slug having bool_or(not es.shown_in_stack)`;

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect({ experience: row.experience, after: row.hidden_min > row.shown_max }).toEqual({
        experience: row.experience,
        after: true,
      });
    }
  });

  it('fait converger shown_in_stack quand un seed change la valeur d’un lien', async () => {
    const directory = join(workDirectory, 'seeds');
    await cp(seedsDirectory, directory, { recursive: true });
    const path = join(directory, '0004_experiences.sql');
    const content = await readFile(path, 'utf8');
    expect(content).toContain("('nopillo', 'ocr', 7, false)");
    await writeFile(
      path,
      content.replace("('nopillo', 'ocr', 7, false)", "('nopillo', 'ocr', 7, true)"),
    );

    await runSeeds({
      databaseUrl: testDatabaseUrl(),
      directory,
      migrationsDirectory,
      log: () => undefined,
    });

    const [row] = await sql<{ shown_in_stack: boolean }[]>`
      select es.shown_in_stack from experience_skills es
      join experiences e on e.id = es.experience_id join skills s on s.id = es.skill_id
      where e.slug = 'nopillo' and s.slug = 'ocr'`;
    expect(row?.shown_in_stack).toBe(true);
  });
});
