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

/**
 * Complétude de la traduction `en` (DEC-1, docs/01) : une traduction `en` d'une entité publiée a les
 * mêmes colonnes non nulles que la `fr`, et des tableaux non vides si la `fr` en a. Le seed échoue
 * sinon, comme pour le contrôle `fr`, et ne laisse rien d'appliqué.
 */
describe('complétude de la traduction en des seeds', () => {
  let sql: Sql;
  let workDirectory: string;

  const run = (directory: string) =>
    runSeeds({
      databaseUrl: testDatabaseUrl(),
      directory,
      migrationsDirectory,
      log: () => undefined,
    });

  /** Seeds réels + un fichier de seed supplémentaire qui dégrade une ligne `en`. */
  async function seedsPlus(statement: string): Promise<string> {
    const directory = join(workDirectory, 'seeds');
    await rm(directory, { recursive: true, force: true });
    await cp(seedsDirectory, directory, { recursive: true });
    await writeFile(join(directory, '0099_en_lacunaire.sql'), statement);
    return directory;
  }

  async function contentHash(): Promise<string> {
    const rows = await sql<{ hash: string }[]>`
      select md5(string_agg(t::text, '|' order by t::text)) as hash
      from experiences_translations t`;
    return rows[0]?.hash ?? '';
  }

  beforeAll(() => {
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await resetTestDatabase();
    workDirectory = await mkdtemp(join(tmpdir(), 'siteperso-seeds-en-'));
    return async () => {
      await rm(workDirectory, { recursive: true, force: true });
    };
  });

  it('accepte les seeds du dépôt : toutes les traductions en publiées sont complètes', async () => {
    await expect(run(seedsDirectory)).resolves.toBeDefined();
  });

  it('refuse une colonne non nulle en français et nulle en anglais, sans rien appliquer', async () => {
    const before = await contentHash();
    const directory = await seedsPlus(
      `update experiences_translations set location = null
       where locale = 'en' and experience_id = (select id from experiences where slug = 'contentsquare');`,
    );

    await expect(run(directory)).rejects.toThrow(
      /Traduction en incomplète.*experiences\/contentsquare \(location\)/,
    );
    expect(await contentHash()).toBe(before);
  });

  it('refuse un tableau vide en anglais quand le français a des éléments', async () => {
    const directory = await seedsPlus(
      `update experiences_translations set achievements = '{}'
       where locale = 'en' and experience_id = (select id from experiences where slug = 'contentsquare');`,
    );

    await expect(run(directory)).rejects.toThrow(
      /Traduction en incomplète.*experiences\/contentsquare \(achievements\)/,
    );
  });

  it('liste tous les champs et toutes les entités lacunaires', async () => {
    const directory = await seedsPlus(
      `update experiences_translations set location = null, logo_alt = null
       where locale = 'en' and experience_id = (select id from experiences where slug = 'contentsquare');
       update education_translations set description = null
       where locale = 'en' and education_id = (select id from education where slug = 'eemi');`,
    );

    const failure = await run(directory).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    expect(message).toContain('education/eemi (description)');
    expect(message).toContain('experiences/contentsquare (location, logo_alt)');
  });

  it('accepte une colonne nulle des deux côtés et une entité sans traduction en', async () => {
    const directory = await seedsPlus(
      `delete from experiences_translations
       where locale = 'en' and experience_id = (select id from experiences where slug = 'contentsquare');`,
    );

    await expect(run(directory)).resolves.toBeDefined();
  });

  it('ne contrôle pas une entité non publiée', async () => {
    const directory = await seedsPlus(
      `update experiences set published = false where slug = 'contentsquare';
       update experiences_translations set location = null
       where locale = 'en' and experience_id = (select id from experiences where slug = 'contentsquare');`,
    );

    await expect(run(directory)).resolves.toBeDefined();
  });
});
