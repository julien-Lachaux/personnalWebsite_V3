import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';

import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import * as schema from '../schema/index.js';
import { DrizzleAiOverviewRepository } from './drizzle-ai-overview.repository.js';

/**
 * Doublure sans base (driver « proxy ») : mémorise les requêtes, répond selon la table lue. Les
 * lignes sont des tableaux, dans l'ordre des colonnes du `select`. `withOverview` à `false`
 * simule une section absente.
 */
function clientDouble(withOverview: boolean) {
  const queries: string[] = [];
  const db = drizzle(
    (query) => {
      queries.push(query);
      if (query.includes('from "skills"')) {
        return Promise.resolve({
          rows: [
            ['mastra', 'Mastra', 3, 'mastra', null, 'ia', null],
            ['agentic-development', 'Développement agentique', 3, 'agent', null, 'ia', null],
          ],
        });
      }
      return Promise.resolve({
        rows: withOverview ? [['Titre', 'Produit', ['Usage'], 'Quotidien', 'Texte']] : [],
      });
    },
    { schema },
  );
  return { queries, client: { db } as unknown as DrizzleDatabaseClient };
}

describe('DrizzleAiOverviewRepository (BF-5)', () => {
  it('assemble la ligne traduite et ses compétences, en deux requêtes', async () => {
    const { queries, client } = clientDouble(true);

    const overview = await new DrizzleAiOverviewRepository(client).findAiOverview('en');

    expect(queries).toHaveLength(2);
    expect(overview).toEqual({
      title: 'Titre',
      inProductLabel: 'Produit',
      inProductItems: ['Usage'],
      dailyLabel: 'Quotidien',
      dailyText: 'Texte',
      skills: [
        {
          slug: 'mastra',
          name: 'Mastra',
          level: 3,
          icon: 'mastra',
          iconPath: null,
          groupSlug: 'ia',
          mainStackOrder: null,
        },
        {
          slug: 'agentic-development',
          name: 'Développement agentique',
          level: 3,
          icon: 'agent',
          iconPath: null,
          groupSlug: 'ia',
          mainStackOrder: null,
        },
      ],
    });
  });

  it('renvoie null sans ligne de section, même si des compétences sont liées', async () => {
    const { client } = clientDouble(false);

    await expect(new DrizzleAiOverviewRepository(client).findAiOverview('fr')).resolves.toBeNull();
  });

  it('filtre la ligne unique non supprimée et trie les compétences par sort_order', async () => {
    const { queries, client } = clientDouble(true);

    await new DrizzleAiOverviewRepository(client).findAiOverview('fr');

    const overviewQuery = queries.find((query) => query.includes('from "ai_overview"')) ?? '';
    const skillsQuery = queries.find((query) => query.includes('from "skills"')) ?? '';
    expect(overviewQuery).toContain('"ai_overview"."deleted_at" is null');
    expect(skillsQuery).toMatch(/order by "ai_overview_skills"\."sort_order" asc/);
  });
});
