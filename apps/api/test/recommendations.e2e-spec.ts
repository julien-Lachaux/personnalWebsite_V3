import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { CvSchema, type Recommendation, RecommendationSchema } from '@siteperso/contracts';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { RECOMMENDATIONS_REPOSITORY } from '../src/application/recommendations/ports/recommendations-repository.port.js';
import { openTestSql, resetTestDatabase } from './support/database.js';
import { appWithOverrides } from './support/override-app.js';
import { expectProblem } from './support/problem.js';
import { startTestApp } from './support/test-app.js';
import { validate } from './support/validate.js';

const RecommendationsSchema = z.array(RecommendationSchema);

/** Les trois recommandations seedées (BF-4), dans l'ordre de `sort_order`. */
const SEEDED = ['alexis-coudeyras', 'steeve-chevry', 'eric-bisceglia'];

describe('GET /api/v1/recommendations (BF-4)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  const get = (url: string) => app.inject({ method: 'GET', url });

  async function list(lang?: 'fr' | 'en'): Promise<Recommendation[]> {
    const url =
      lang === undefined ? '/api/v1/recommendations' : `/api/v1/recommendations?lang=${lang}`;
    const response = await get(url);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    return validate(RecommendationsSchema, response.json());
  }

  async function alter(statement: (sql: Sql) => Promise<unknown>): Promise<void> {
    const sql = openTestSql();
    try {
      await statement(sql);
    } finally {
      await sql.end();
    }
  }

  describe('base seedée', () => {
    it('sert les trois recommandations en français, par sort_order, avec leurs dates', async () => {
      const recommendations = await list();

      expect(recommendations.map((r) => [r.slug, r.recommendedOn, r.locale])).toEqual([
        ['alexis-coudeyras', '2025-12-08', 'fr'],
        ['steeve-chevry', '2020-11-04', 'fr'],
        ['eric-bisceglia', '2020-09-25', 'fr'],
      ]);
      expect(recommendations.map((r) => r.paragraphs.length)).toEqual([6, 4, 1]);
      expect(recommendations[0]).toMatchObject({
        authorName: 'Alexis Coudeyras',
        authorRole: 'CTO',
        relationship: 'Responsable direct de Julien',
      });
      expect(recommendations[0]?.paragraphs.at(-1)).toBe(
        'Cette mission a été un gros succès pour Contentsquare.',
      );
      expect(await list('fr')).toStrictEqual(recommendations);
    });

    it('?lang=en sert la ligne fr entière (citations non traduites), locale fr', async () => {
      expect(await list('en')).toStrictEqual(await list('fr'));
    });

    it.each(['fr', 'en'] as const)(
      'cv.recommendations est égal à la route (lang=%s)',
      async (lang) => {
        const cv = validate(CvSchema, (await get(`/api/v1/cv?lang=${lang}`)).json());

        expect(cv.recommendations).toStrictEqual(await list(lang));
      },
    );

    it('?lang=de : 400 problem+json', async () => {
      const problem = expectProblem(await get('/api/v1/recommendations?lang=de'), 400);

      expect(problem.instance).toBe('/api/v1/recommendations?lang=de');
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
      '%s : 405 problem+json avec Allow',
      async (method) => {
        const response = await app.inject({ method, url: '/api/v1/recommendations' });

        expectProblem(response, 405);
        expect(response.headers.allow).toBe('GET, HEAD, OPTIONS');
      },
    );

    it('ne contient ni e-mail ni téléphone (hors dates YYYY-MM-DD)', async () => {
      const response = await get('/api/v1/recommendations');
      const texts = JSON.stringify(
        (await list()).map(({ recommendedOn: _date, ...texts }) => texts),
      );

      expect(response.body).not.toMatch(/@/);
      expect(texts).not.toMatch(/\+?\d[\d .-]{8,}\d/);
    });
  });

  describe('contenu modifié par le test', () => {
    beforeEach(async () => {
      await resetTestDatabase();
    });

    it('une ligne en existante est servie entière en ?lang=en, avec locale en', async () => {
      await alter(
        (sql) => sql`
          insert into recommendations_translations
            (recommendation_id, locale, author_role, relationship, paragraphs)
          select id, 'en', 'Interim CTO', 'Direct manager', array['First.', 'Second.']
          from recommendations where slug = 'steeve-chevry'`,
      );

      const fr = await list('fr');
      const en = await list('en');

      expect(en[1]).toStrictEqual({
        ...fr[1],
        authorRole: 'Interim CTO',
        relationship: 'Direct manager',
        paragraphs: ['First.', 'Second.'],
        locale: 'en',
      });
      expect(fr[1]?.locale).toBe('fr');
      expect([en[0], en[2]]).toStrictEqual([fr[0], fr[2]]);
      const cv = validate(CvSchema, (await get('/api/v1/cv?lang=en')).json());
      expect(cv.recommendations).toStrictEqual(en);
    });

    it('suit sort_order, puis id à égalité', async () => {
      await alter(
        (sql) => sql`
          update recommendations set sort_order = case slug
            when 'eric-bisceglia' then 0 when 'alexis-coudeyras' then 5 else 0 end`,
      );

      expect((await list()).map((r) => r.slug)).toEqual([
        'steeve-chevry',
        'eric-bisceglia',
        'alexis-coudeyras',
      ]);
    });

    it('exclut une recommandation non publiée, de la route comme de /cv', async () => {
      await alter(
        (sql) => sql`update recommendations set published = false where slug = 'steeve-chevry'`,
      );

      expect((await list()).map((r) => r.slug)).toEqual(['alexis-coudeyras', 'eric-bisceglia']);
      const cv = validate(CvSchema, (await get('/api/v1/cv')).json());
      expect(cv.recommendations.map((r) => r.slug)).toEqual(['alexis-coudeyras', 'eric-bisceglia']);
    });

    it('n’envoie jamais une recommandation marquée deleted_at, ni sa traduction en', async () => {
      await alter(async (sql) => {
        await sql`
          insert into recommendations_translations
            (recommendation_id, locale, author_role, relationship, paragraphs)
          select id, 'en', 'Role', 'Relation', array['Text.']
          from recommendations where slug = 'alexis-coudeyras'`;
        await sql`update recommendations set deleted_at = now() where slug = 'alexis-coudeyras'`;
      });

      for (const lang of ['fr', 'en'] as const) {
        expect((await list(lang)).map((r) => r.slug)).toEqual(SEEDED.slice(1));
        const cv = validate(CvSchema, (await get(`/api/v1/cv?lang=${lang}`)).json());
        expect(cv.recommendations.map((r) => r.slug)).toEqual(SEEDED.slice(1));
      }
    });

    it('sans recommandation : liste vide, et /cv reste servi', async () => {
      await alter((sql) => sql`delete from recommendations`);

      expect(await list()).toEqual([]);
      const cv = validate(CvSchema, (await get('/api/v1/cv')).json());
      expect(cv.recommendations).toEqual([]);
    });
  });

  it('un dépôt en échec donne un 500 problem+json générique, route et /cv', async () => {
    const failing = await appWithOverrides([
      [
        RECOMMENDATIONS_REPOSITORY,
        { findAllPublished: () => Promise.reject(new Error('secret-interne')) },
      ],
    ]);
    try {
      for (const url of ['/api/v1/recommendations', '/api/v1/cv']) {
        const response = await failing.inject({ method: 'GET', url });

        expectProblem(response, 500);
        expect(response.body).not.toContain('secret-interne');
      }
    } finally {
      await failing.close();
    }
  });
});
