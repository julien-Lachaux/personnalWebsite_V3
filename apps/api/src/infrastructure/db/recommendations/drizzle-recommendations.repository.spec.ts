import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';

import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import * as schema from '../schema/index.js';
import { DrizzleRecommendationsRepository } from './drizzle-recommendations.repository.js';

interface Query {
  sql: string;
  params: unknown[];
}

/** Doublure sans base (driver « proxy ») : mémorise la requête, répond des lignes en tableaux. */
function clientDouble() {
  const queries: Query[] = [];
  const db = drizzle(
    (sql, params) => {
      queries.push({ sql, params });
      // slug, authorName, authorRole, relationship, recommendedOn, paragraphs, locale.
      return Promise.resolve({
        rows: [['prenom-nom', 'Prénom Nom', 'CTO', 'Manager', '2025-12-08', ['Texte.'], 'fr']],
      });
    },
    { schema },
  );
  return { queries, client: { db } as unknown as DrizzleDatabaseClient };
}

describe('DrizzleRecommendationsRepository (BF-4)', () => {
  it('une requête : publiées seulement, non supprimées, triées par sort_order puis id', async () => {
    const { queries, client } = clientDouble();

    const result = await new DrizzleRecommendationsRepository(client).findAllPublished('en');

    expect(queries).toHaveLength(1);
    const [{ sql, params }] = queries as [Query];
    const position = Number(/"recommendations"\."published" = \$(\d+)/.exec(sql)?.[1]);
    expect(params[position - 1]).toBe(true);
    expect(sql).toContain('"recommendations"."deleted_at" is null');
    expect(sql).toMatch(
      /order by "recommendations"\."sort_order" asc, "recommendations"\."id" asc$/,
    );
    expect(result).toEqual([
      {
        slug: 'prenom-nom',
        authorName: 'Prénom Nom',
        authorRole: 'CTO',
        relationship: 'Manager',
        recommendedOn: '2025-12-08',
        paragraphs: ['Texte.'],
        locale: 'fr',
      },
    ]);
  });

  it('lit la langue de la ligne servie, pas celle de la requête', async () => {
    const { queries, client } = clientDouble();

    await new DrizzleRecommendationsRepository(client).findAllPublished('en');

    expect(queries[0]?.sql).toContain(
      'case when "recommendations_translations_en"."locale" is null then "recommendations_translations_fr"."locale" else "recommendations_translations_en"."locale" end',
    );
  });
});
