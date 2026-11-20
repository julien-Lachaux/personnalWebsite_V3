import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../src/infrastructure/db/reset-database.js';
import {
  baseDatabaseName,
  migrationsDirectory,
  modelDatabaseName,
  openAdminSql,
  openTestSql,
  quoteIdentifier,
  resetTestDatabase,
  seedsDirectory,
  testDatabaseUrl,
  urlForDatabase,
  workerDatabaseName,
  workerId,
} from '../support/database.js';

/**
 * Preuve d'équivalence : la base de test recopiée du modèle (`resetTestDatabase`) est identique à
 * une base construite par `resetDatabase` (schéma vidé, migrations, seeds), schéma et données.
 */

const base = baseDatabaseName(testDatabaseUrl());
const referenceName = `${workerDatabaseName(base, workerId())}_ref`;

/** Résultat d'une requête, normalisé en JSON pour une comparaison profonde. */
async function rows(sql: Sql, statement: string): Promise<unknown[]> {
  return JSON.parse(JSON.stringify(await sql.unsafe(statement))) as unknown[];
}

/** Tables du schéma `public`, hors table des migrations (comparée à part). */
async function tableNames(sql: Sql): Promise<string[]> {
  const found = await sql<{ name: string }[]>`
    select table_name as name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name`;
  return found.map((row) => row.name);
}

/** Description complète d'une base : tout ce que `db:reset` produit, moins l'horodatage des migrations. */
async function describeDatabase(sql: Sql): Promise<Record<string, unknown>> {
  const tables = await tableNames(sql);
  const content: Record<string, unknown[]> = {};
  for (const table of tables) {
    const columns = table === 'schema_migrations' ? 'version, name, checksum' : '*';
    content[table] = await rows(
      sql,
      `select ${columns} from ${quoteIdentifier(table)} order by 1, to_jsonb(${quoteIdentifier(table)})::text`,
    );
  }
  return {
    tables,
    columns: await rows(
      sql,
      `select table_name, column_name, ordinal_position, data_type, udt_name, is_nullable,
              column_default, is_identity, identity_generation, character_maximum_length,
              numeric_precision, datetime_precision, is_generated, generation_expression
       from information_schema.columns where table_schema = 'public'
       order by table_name, ordinal_position`,
    ),
    constraints: await rows(
      sql,
      `select conrelid::regclass::text as relation, conname, contype, pg_get_constraintdef(oid) as definition,
              condeferrable, condeferred, convalidated
       from pg_constraint where connamespace = 'public'::regnamespace
       order by conrelid::regclass::text, conname`,
    ),
    indexes: await rows(
      sql,
      `select tablename, indexname, indexdef from pg_indexes where schemaname = 'public'
       order by tablename, indexname`,
    ),
    sequences: await rows(
      sql,
      `select sequencename, data_type::text, start_value, min_value, max_value, increment_by,
              cycle, cache_size, last_value
       from pg_sequences where schemaname = 'public' order by sequencename`,
    ),
    enums: await rows(
      sql,
      `select t.typname, e.enumlabel, e.enumsortorder
       from pg_type t join pg_enum e on e.enumtypid = t.oid
       where t.typnamespace = 'public'::regnamespace order by t.typname, e.enumsortorder`,
    ),
    routines: await rows(
      sql,
      `select proname, pg_get_functiondef(oid) as definition from pg_proc
       where pronamespace = 'public'::regnamespace order by proname`,
    ),
    triggers: await rows(
      sql,
      `select tgrelid::regclass::text as relation, tgname, pg_get_triggerdef(oid) as definition
       from pg_trigger where not tgisinternal order by 1, 2`,
    ),
    relations: await rows(
      sql,
      `select relname, relkind, pg_get_userbyid(relowner) as owner, relacl::text as acl,
              reloptions::text as options
       from pg_class where relnamespace = 'public'::regnamespace order by relname`,
    ),
    schemas: await rows(
      sql,
      `select nspname, pg_get_userbyid(nspowner) as owner, nspacl::text as acl
       from pg_namespace where nspname = 'public'`,
    ),
    defaultPrivileges: await rows(
      sql,
      `select pg_get_userbyid(defaclrole) as role, defaclobjtype, defaclacl::text as acl
       from pg_default_acl order by 1, 2`,
    ),
    content,
  };
}

describe('base de test recopiée du modèle', () => {
  let admin: Sql;
  let reference: Sql;

  beforeAll(async () => {
    admin = openAdminSql(testDatabaseUrl());
    await admin.unsafe(`drop database if exists ${quoteIdentifier(referenceName)} with (force)`);
    await admin.unsafe(`create database ${quoteIdentifier(referenceName)}`);
    // Référence : la séquence d'avant le modèle, rejouée de zéro dans une base séparée.
    const referenceUrl = urlForDatabase(testDatabaseUrl(), referenceName);
    await resetDatabase({
      databaseUrl: referenceUrl,
      migrationsDirectory,
      seedsDirectory,
      log: () => undefined,
    });
    reference = postgres(referenceUrl, { max: 1, onnotice: () => undefined });
  });

  afterAll(async () => {
    await reference.end({ timeout: 5 });
    await admin.unsafe(`drop database if exists ${quoteIdentifier(referenceName)} with (force)`);
    await admin.end({ timeout: 5 });
    await resetTestDatabase();
  });

  it('le modèle existe, distinct de la base du processus', async () => {
    const names = await admin<{ datname: string }[]>`
      select datname from pg_database where datname in
        (${modelDatabaseName(base)}, ${workerDatabaseName(base, workerId())})`;

    expect(names.map((row) => row.datname).sort()).toEqual(
      [modelDatabaseName(base), workerDatabaseName(base, workerId())].sort(),
    );
  });

  it('est identique à une base migrée et seedée : schéma, séquences, migrations, contenu', async () => {
    await resetTestDatabase();
    const sql = openTestSql();
    try {
      const copy = await describeDatabase(sql);
      const built = await describeDatabase(reference);

      // Garde contre une comparaison creuse : des tables, des lignes, des séquences avancées.
      expect(built['tables']).toEqual(
        expect.arrayContaining(['profile', 'skills', 'schema_migrations']),
      );
      const content = built['content'] as Record<string, unknown[]>;
      expect(content['profile']?.length).toBeGreaterThan(0);
      expect(content['skills']?.length).toBeGreaterThan(0);
      expect((content['schema_migrations'] ?? []).length).toBeGreaterThan(10);
      expect(
        (built['sequences'] as { last_value: unknown }[]).some((row) => row.last_value !== null),
      ).toBe(true);

      expect(copy).toEqual(built);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('garde la table des migrations avec ses empreintes, et un horodatage posé', async () => {
    await resetTestDatabase();
    const sql = openTestSql();
    try {
      const [copied, built] = await Promise.all([
        sql<{ version: string; checksum: string; applied: boolean }[]>`
          select version, checksum, applied_at is not null as applied
          from schema_migrations order by version`,
        reference<{ version: string; checksum: string; applied: boolean }[]>`
          select version, checksum, applied_at is not null as applied
          from schema_migrations order by version`,
      ]);

      expect(copied.length).toBeGreaterThan(10);
      expect(copied.map((row) => [row.version, row.checksum, row.applied])).toEqual(
        built.map((row) => [row.version, row.checksum, row.applied]),
      );
      expect(copied.every((row) => /^[0-9a-f]{64}$/.test(row.checksum) && row.applied)).toBe(true);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it.each([
    [
      'données, schéma et séquences altérés',
      `truncate table profile restart identity cascade;
       create table t_residu (id int);
       alter table skills add column residu text;
       create index t_residu_index on skills (id);
       select nextval(pg_get_serial_sequence('skills', 'id'))`,
    ],
    [
      'schéma vidé (comme après un test de migrations)',
      'drop schema public cascade; create schema public',
    ],
  ])('efface toute altération de la base précédente : %s', async (_label, statements) => {
    const sql = openTestSql();
    try {
      await sql.unsafe(statements);
    } finally {
      await sql.end({ timeout: 5 });
    }

    await resetTestDatabase();
    const restored = openTestSql();
    try {
      expect(await describeDatabase(restored)).toEqual(await describeDatabase(reference));
    } finally {
      await restored.end({ timeout: 5 });
    }
  });

  it('coupe les connexions ouvertes et les laisse se rouvrir à la requête suivante', async () => {
    const sql = openTestSql();
    try {
      for (let round = 0; round < 10; round += 1) {
        await sql.unsafe('create table t_marqueur (id int)');
        await resetTestDatabase();
        const marker = await sql<{ present: boolean }[]>`
          select to_regclass('public.t_marqueur') is not null as present`;
        expect(marker[0]?.present).toBe(false);
        const profiles = await sql<{ count: number }[]>`select count(*)::int as count from profile`;
        expect(profiles[0]?.count).toBe(1);
      }
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
