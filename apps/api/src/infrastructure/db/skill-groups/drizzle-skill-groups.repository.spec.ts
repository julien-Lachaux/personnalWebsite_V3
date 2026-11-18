import { type Logger } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';

import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import * as schema from '../schema/index.js';
import { DrizzleSkillGroupsRepository } from './drizzle-skill-groups.repository.js';

/**
 * Doublure de `DrizzleDatabaseClient` : un `drizzle` branché sur le driver « proxy » (aucune base),
 * avec un logger qui compte les requêtes émises. Le proxy répond selon la table interrogée.
 */
function clientDouble() {
  const queries: string[] = [];
  const logger: Logger = {
    logQuery: (query) => {
      queries.push(query);
    },
  };
  const db = drizzle(
    (query) => {
      // Les lignes sont des tableaux, dans l'ordre des colonnes du `select`.
      if (query.includes('from "skills"')) {
        return Promise.resolve({
          rows: [
            ['typescript', 'TypeScript', 3, 'typescript', null, 'langages'],
            ['node', 'Node.js', 3, 'nodejs', null, 'langages'],
            ['postgresql', 'PostgreSQL', 3, 'postgresql', null, 'donnees'],
          ],
        });
      }
      return Promise.resolve({
        rows: [
          ['langages', 'Langages', ''],
          ['donnees', 'Données', 'Bases de données'],
          ['vide', 'Sans compétence', ''],
        ],
      });
    },
    { schema, logger },
  );
  return { queries, client: { db } as unknown as DrizzleDatabaseClient };
}

describe('DrizzleSkillGroupsRepository', () => {
  it('charge groupes et compétences en au plus deux requêtes (pas de N+1)', async () => {
    const { queries, client } = clientDouble();

    const groups = await new DrizzleSkillGroupsRepository(client).findAllPublished('fr');

    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(2);
    expect(groups).toHaveLength(3);
  });

  it('rattache chaque compétence à son groupe, dans l’ordre reçu', async () => {
    const { client } = clientDouble();

    const groups = await new DrizzleSkillGroupsRepository(client).findAllPublished('en');

    expect(groups.map((group) => group.slug)).toEqual(['langages', 'donnees', 'vide']);
    expect(groups[0]?.skills.map((skill) => skill.slug)).toEqual(['typescript', 'node']);
    expect(groups[1]?.skills.map((skill) => skill.slug)).toEqual(['postgresql']);
    expect(groups[2]?.skills).toEqual([]);
  });

  it('garde le nombre de requêtes constant quelle que soit la taille des données', async () => {
    const { queries, client } = clientDouble();
    const repository = new DrizzleSkillGroupsRepository(client);

    await repository.findAllPublished('fr');
    const afterFirst = queries.length;
    await repository.findAllPublished('en');

    expect(queries.length - afterFirst).toBe(afterFirst);
  });
});
