import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';

import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import * as schema from '../schema/index.js';
import { DrizzleExperiencesRepository } from './drizzle-experiences.repository.js';

describe('DrizzleExperiencesRepository : publication', () => {
  it('ne lit que les expériences publiées et non supprimées', async () => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const db = drizzle(
      (sql, params) => {
        queries.push({ sql, params });
        return Promise.resolve({ rows: [] });
      },
      { schema },
    );

    await new DrizzleExperiencesRepository({
      db,
    } as unknown as DrizzleDatabaseClient).findAllPublished('fr');

    const [query] = queries;
    const position = Number(/"experiences"\."published" = \$(\d+)/.exec(query?.sql ?? '')?.[1]);
    expect(query?.params[position - 1]).toBe(true);
    expect(query?.sql).toContain('"experiences"."deleted_at" is null');
  });
});
