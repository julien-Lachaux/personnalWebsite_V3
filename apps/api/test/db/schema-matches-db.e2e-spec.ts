import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as schema from '../../src/infrastructure/db/schema/index.js';
import { openTestSql, resetTestDatabase } from '../support/database.js';

interface ColumnShape {
  type: string;
  nullable: boolean;
}

/** `table.colonne` → type SQL et nullabilité, tels que déclarés dans le schéma Drizzle. */
function drizzleColumns(): Map<string, ColumnShape> {
  const columns = new Map<string, ColumnShape>();
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    for (const column of config.columns) {
      columns.set(`${config.name}.${column.name}`, {
        type: column.getSQLType(),
        nullable: !column.notNull,
      });
    }
  }
  return columns;
}

describe('schéma Drizzle et base migrée', () => {
  let sql: Sql;

  beforeAll(async () => {
    await resetTestDatabase();
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it('déclare exactement les mêmes colonnes (nom, type, nullabilité) que information_schema', async () => {
    // `format_type` donne le type tel qu'écrit dans le SQL (integer, text[], experience_kind,
    // locale_code…) ; `information_schema.columns` fournit la nullabilité et la liste des tables.
    const rows = await sql<
      { table_name: string; column_name: string; type: string; is_nullable: string }[]
    >`
      select c.table_name, c.column_name, format_type(a.atttypid, a.atttypmod) as type, c.is_nullable
      from information_schema.columns c
      join pg_class k on k.relname = c.table_name
      join pg_namespace n on n.oid = k.relnamespace and n.nspname = c.table_schema
      join pg_attribute a on a.attrelid = k.oid and a.attname = c.column_name
      where c.table_schema = 'public' and c.table_name <> 'schema_migrations'`;
    const actual = new Map<string, ColumnShape>(
      rows.map((row) => [
        `${row.table_name}.${row.column_name}`,
        { type: row.type, nullable: row.is_nullable === 'YES' },
      ]),
    );

    const expected = drizzleColumns();

    expect(expected.size).toBe(actual.size);
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [key, shape] of expected) {
      expect({ column: key, ...actual.get(key) }).toEqual({ column: key, ...shape });
    }
  });

  it('déclare les 24 tables du schéma', () => {
    const tables = Object.values(schema).filter((value) => is(value, PgTable));
    expect(tables).toHaveLength(24);
  });
});
