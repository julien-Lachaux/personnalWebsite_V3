import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';

import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import * as schema from '../schema/index.js';
import { DrizzleSkillsRepository } from './drizzle-skills.repository.js';

interface Query {
  sql: string;
  params: unknown[];
}

/** Valeur du paramètre lié à `colonne = $n` dans la requête. */
function boundTo({ sql, params }: Query, column: string): unknown {
  const match = new RegExp(`${column.replaceAll('.', '\\.')} = \\$(\\d+)`).exec(sql);
  expect(match, column).not.toBeNull();
  return params[Number(match?.[1]) - 1];
}

describe('requête de base des compétences : publication', () => {
  it('exige une compétence ET un groupe publiés, non supprimés', async () => {
    const queries: Query[] = [];
    const db = drizzle(
      (sql, params) => {
        queries.push({ sql, params });
        return Promise.resolve({ rows: [] });
      },
      { schema },
    );

    await new DrizzleSkillsRepository({ db } as unknown as DrizzleDatabaseClient).findAllPublished(
      'fr',
    );

    const [query] = queries as [Query];
    expect(boundTo(query, '"skills"."published"')).toBe(true);
    expect(boundTo(query, '"skill_groups"."published"')).toBe(true);
    expect(query.sql).toContain('"skills"."deleted_at" is null');
    expect(query.sql).toContain('"skill_groups"."deleted_at" is null');
  });
});
