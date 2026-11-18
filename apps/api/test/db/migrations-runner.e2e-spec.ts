import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from '../../src/infrastructure/db/migrations-runner.js';
import { resetTestDatabase, testDatabaseUrl } from '../support/database.js';

const databaseUrl = testDatabaseUrl();

describe('runner de migrations (base de test)', () => {
  let sql: Sql;
  let directory: string;
  const log = () => undefined;

  beforeAll(() => {
    sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
    // Laisse la base de test migrée et seedée pour les e2e suivants.
    await resetTestDatabase();
  });

  beforeEach(async () => {
    await sql.unsafe('drop schema public cascade; create schema public');
    directory = await mkdtemp(join(tmpdir(), 'siteperso-migrations-'));
    return async () => {
      await rm(directory, { recursive: true, force: true });
    };
  });

  it('applique une fois chaque fichier puis les déclare déjà appliqués', async () => {
    await writeFile(join(directory, '0001_first.sql'), 'create table t_first (id int);');
    await writeFile(join(directory, '0002_second.sql'), 'create table t_second (id int);');

    const first = await runMigrations({ databaseUrl, directory, log });
    const second = await runMigrations({ databaseUrl, directory, log });

    expect(first.applied).toEqual(['0001_first', '0002_second']);
    expect(second.applied).toEqual([]);
    expect(second.alreadyApplied).toEqual(['0001_first', '0002_second']);
    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count from schema_migrations`;
    expect(rows[0]?.count).toBe(2);
  });

  it('annule la transaction d’un fichier invalide : rien n’est enregistré', async () => {
    await writeFile(join(directory, '0001_ok.sql'), 'create table t_ok (id int);');
    await writeFile(
      join(directory, '0002_bad.sql'),
      'create table t_bad (id int);\nselect * from table_inexistante;',
    );

    await expect(runMigrations({ databaseUrl, directory, log })).rejects.toThrow();

    const versions = await sql<{ version: string }[]>`select version from schema_migrations`;
    expect(versions.map((row) => row.version)).toEqual(['0001']);
    const bad = await sql<{ present: boolean }[]>`
      select to_regclass('public.t_bad') is not null as present`;
    expect(bad[0]?.present).toBe(false);
  });

  it('échoue avec une erreur de checksum si un fichier appliqué est modifié', async () => {
    const file = join(directory, '0001_first.sql');
    await writeFile(file, 'create table t_first (id int);');
    await runMigrations({ databaseUrl, directory, log });

    await writeFile(file, 'create table t_first (id int, extra int);');

    await expect(runMigrations({ databaseUrl, directory, log })).rejects.toThrow(/checksum/i);
  });
});
