import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { CvSchema, type Experience, ExperienceSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';
import { validate } from './support/validate.js';

const ExperiencesSchema = z.array(ExperienceSchema);

/** Liens cachés seedés (BF-2, brief back-001) : mots-clés du filtre, absents de la pile. */
const HIDDEN: Record<string, string[]> = {
  nopillo: ['ocr', 'agentic-development'],
  contentsquare: ['google-analytics', 'adobe-analytics', 'production-operations'],
  'wynd-integration': ['rest-api', 'production-operations'],
  afluens: ['rest-api'],
};

/** `[slug, shownInStack]` de chaque compétence d'une expérience, dans l'ordre servi. */
function links(experiences: Experience[], slug: string): [string, boolean][] {
  const experience = experiences.find((candidate) => candidate.slug === slug);
  return (experience?.skills ?? []).map((skill) => [skill.slug, skill.shownInStack]);
}

describe('compétences d’une expérience : shownInStack (BF-2)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  async function experiences(lang: 'fr' | 'en'): Promise<Experience[]> {
    const response = await app.inject({ method: 'GET', url: `/api/v1/experiences?lang=${lang}` });
    expect(response.statusCode).toBe(200);
    return validate(ExperiencesSchema, response.json());
  }

  it.each(['fr', 'en'] as const)(
    'nopillo : six puces puis les deux mots-clés cachés, dans l’ordre de sort_order (lang=%s)',
    async (lang) => {
      expect(links(await experiences(lang), 'nopillo')).toEqual([
        ['typescript', true],
        ['elysia', true],
        ['solidjs', true],
        ['mastra', true],
        ['posthog', true],
        ['docker', true],
        ['ocr', false],
        ['agentic-development', false],
      ]);
    },
  );

  it.each(['fr', 'en'] as const)(
    'les liens cachés sont exactement ceux du brief, toutes expériences confondues (lang=%s)',
    async (lang) => {
      const hidden: Record<string, string[]> = {};
      for (const experience of await experiences(lang)) {
        const slugs = experience.skills.filter((s) => !s.shownInStack).map((s) => s.slug);
        if (slugs.length > 0) {
          hidden[experience.slug] = slugs;
        }
      }

      expect(hidden).toEqual(HIDDEN);
    },
  );

  it.each(['fr', 'en'] as const)('cv.experiences porte les mêmes liens (lang=%s)', async (lang) => {
    const cv = validate(
      CvSchema,
      (await app.inject({ method: 'GET', url: `/api/v1/cv?lang=${lang}` })).json(),
    );

    expect(cv.experiences).toStrictEqual(await experiences(lang));
    expect(links(cv.experiences, 'afluens').at(-1)).toEqual(['rest-api', false]);
  });

  it('suit la colonne experience_skills.shown_in_stack, sans changer l’ordre', async () => {
    const sql = openTestSql();
    try {
      await sql`
        update experience_skills set shown_in_stack = not shown_in_stack
        where experience_id = (select id from experiences where slug = 'nopillo')
          and skill_id in (select id from skills where slug in ('typescript', 'ocr'))`;
    } finally {
      await sql.end();
    }

    const nopillo = links(await experiences('fr'), 'nopillo');

    expect(nopillo[0]).toEqual(['typescript', false]);
    expect(nopillo[6]).toEqual(['ocr', true]);
    expect(nopillo.map(([slug]) => slug)).toEqual([
      'typescript',
      'elysia',
      'solidjs',
      'mastra',
      'posthog',
      'docker',
      'ocr',
      'agentic-development',
    ]);
  });
});
