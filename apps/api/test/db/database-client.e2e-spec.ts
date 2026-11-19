import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DrizzleDatabaseClient } from '../../src/infrastructure/db/drizzle-database-client.js';
import { testDatabaseUrl } from '../support/database.js';

/** Lève un NOTICE côté serveur : par défaut, le driver `postgres` l'écrirait avec console.log. */
const RAISE_NOTICE = "do $$ begin raise notice 'avis de test'; end $$";

describe('DrizzleDatabaseClient (base de test)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ping renvoie true quand la base répond', async () => {
    const client = new DrizzleDatabaseClient(testDatabaseUrl());
    try {
      expect(await client.ping()).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('n’écrit pas les NOTICE PostgreSQL sur la console (le driver nu, lui, les écrit)', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const raw = postgres(testDatabaseUrl(), { max: 1 });
    try {
      await raw.unsafe(RAISE_NOTICE);
    } finally {
      await raw.end({ timeout: 5 });
    }
    expect(consoleLog).toHaveBeenCalledOnce();
    consoleLog.mockClear();

    const client = new DrizzleDatabaseClient(testDatabaseUrl());
    try {
      await client.db.execute(sql.raw(RAISE_NOTICE));
    } finally {
      await client.close();
    }
    expect(consoleLog).not.toHaveBeenCalled();
  });
});
