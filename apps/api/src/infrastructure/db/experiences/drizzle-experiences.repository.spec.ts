import { type Logger } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';

import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import * as schema from '../schema/index.js';
import { DrizzleExperiencesRepository } from './drizzle-experiences.repository.js';

/**
 * Doublure de `DrizzleDatabaseClient` : `drizzle` branché sur le driver « proxy » (aucune base),
 * avec un logger qui compte les requêtes. `withExperiences` à `false` simule une table vide.
 */
function clientDouble(withExperiences: boolean) {
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
            ['typescript', 'TypeScript', 3, 'typescript', null, 'langages', 1, 2, true],
            ['docker', 'Docker', 3, 'docker', null, 'devops', null, 2, true],
            ['php', 'PHP', 3, 'php', null, 'langages', null, 1, true],
          ],
        });
      }
      if (!withExperiences) {
        return Promise.resolve({ rows: [] });
      }
      const experience = (id: number, slug: string) => [
        id,
        slug,
        'employment',
        'Société',
        null,
        '/images/logos/x.svg',
        'Logo',
        'cdi',
        'hybrid',
        '2024-01-01',
        null,
        'Poste',
        null,
        'Résumé',
        ['A'],
        null,
      ];
      return Promise.resolve({
        rows: [experience(2, 'recente'), experience(1, 'ancienne'), experience(3, 'sans-skills')],
      });
    },
    { schema, logger },
  );
  return { queries, client: { db } as unknown as DrizzleDatabaseClient };
}

describe('DrizzleExperiencesRepository', () => {
  it('charge expériences et compétences en au plus deux requêtes (pas de N+1)', async () => {
    const { queries, client } = clientDouble(true);

    const result = await new DrizzleExperiencesRepository(client).findAllPublished('fr');

    expect(result).toHaveLength(3);
    expect(queries).toHaveLength(2);
  });

  it('rattache chaque compétence à son expérience, dans l’ordre reçu', async () => {
    const { client } = clientDouble(true);

    const result = await new DrizzleExperiencesRepository(client).findAllPublished('en');

    expect(result.map((experience) => experience.slug)).toEqual([
      'recente',
      'ancienne',
      'sans-skills',
    ]);
    expect(result[0]?.skills.map((skill) => skill.slug)).toEqual(['typescript', 'docker']);
    expect(result[1]?.skills.map((skill) => skill.slug)).toEqual(['php']);
    expect(result[2]?.skills).toEqual([]);
    expect(result[0]).not.toHaveProperty('id');
    expect(result[0]?.skills[0]).not.toHaveProperty('experienceId');
  });

  it('ne lance pas la seconde requête quand il n’y a aucune expérience', async () => {
    const { queries, client } = clientDouble(false);

    await expect(new DrizzleExperiencesRepository(client).findAllPublished('fr')).resolves.toEqual(
      [],
    );
    expect(queries).toHaveLength(1);
  });
});
