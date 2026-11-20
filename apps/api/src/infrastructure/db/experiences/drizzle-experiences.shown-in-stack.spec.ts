import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';

import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import * as schema from '../schema/index.js';
import { DrizzleExperiencesRepository } from './drizzle-experiences.repository.js';

/**
 * Doublure sans base (driver « proxy ») : mémorise les requêtes et répond selon la table lue. Les
 * lignes sont des tableaux, dans l'ordre des colonnes du `select`.
 */
function clientDouble() {
  const queries: string[] = [];
  const db = drizzle(
    (query) => {
      queries.push(query);
      if (query.includes('from "skills"')) {
        // slug, name, level, icon, iconPath, groupSlug, puis experienceId et shownInStack.
        return Promise.resolve({
          rows: [
            ['typescript', 'TypeScript', 3, 'typescript', null, 'langages', 7, true],
            ['ocr', 'OCR', 3, 'ocr', null, 'ia', 7, false],
          ],
        });
      }
      return Promise.resolve({
        rows: [
          [
            7,
            'societe',
            'employment',
            'Société',
            null,
            null,
            null,
            'cdi',
            'remote',
            '2024-01-01',
            null,
            'Poste',
            null,
            'Résumé',
            [],
            null,
          ],
        ],
      });
    },
    { schema },
  );
  return { queries, client: { db } as unknown as DrizzleDatabaseClient };
}

describe('DrizzleExperiencesRepository : shownInStack (BF-2)', () => {
  it('lit experience_skills.shown_in_stack et le reporte sur chaque compétence liée', async () => {
    const { queries, client } = clientDouble();

    const [experience] = await new DrizzleExperiencesRepository(client).findAllPublished('fr');

    expect(queries[1]).toContain('"experience_skills"."shown_in_stack"');
    expect(experience?.skills.map((skill) => [skill.slug, skill.shownInStack])).toEqual([
      ['typescript', true],
      ['ocr', false],
    ]);
  });
});
