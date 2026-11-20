import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';

import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import * as schema from '../schema/index.js';
import { DrizzleSkillsRepository } from './drizzle-skills.repository.js';

/** Doublure sans base (driver « proxy ») : mémorise la requête, répond des lignes en tableaux. */
function clientDouble() {
  const queries: string[] = [];
  const db = drizzle(
    (query) => {
      queries.push(query);
      // slug, name, level, icon, iconPath, groupSlug, mainStackOrder.
      return Promise.resolve({
        rows: [
          ['typescript', 'TypeScript', 5, 'typescript', null, 'langages', 1],
          ['php', 'PHP', 3, 'php', null, 'langages', null],
        ],
      });
    },
    { schema },
  );
  return { queries, client: { db } as unknown as DrizzleDatabaseClient };
}

describe('requête de base des compétences : mainStackOrder (BF-3)', () => {
  it('lit skills.main_stack_order et le sert tel quel, null compris', async () => {
    const { queries, client } = clientDouble();

    const skills = await new DrizzleSkillsRepository(client).findAllPublished('fr');

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('"skills"."main_stack_order"');
    expect(skills.map((skill) => [skill.slug, skill.mainStackOrder])).toEqual([
      ['typescript', 1],
      ['php', null],
    ]);
  });
});
