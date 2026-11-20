import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { type AiOverview, AiOverviewSchema, CvSchema } from '@siteperso/contracts';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AI_OVERVIEW_REPOSITORY } from '../src/application/ai-overview/ports/ai-overview-repository.port.js';
import { openTestSql, resetTestDatabase } from './support/database.js';
import { appWithOverrides } from './support/override-app.js';
import { expectProblem } from './support/problem.js';
import { startTestApp } from './support/test-app.js';
import { validate } from './support/validate.js';

describe('GET /api/v1/ai-overview (BF-5)', () => {
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

  async function overview(lang?: 'fr' | 'en'): Promise<AiOverview> {
    const url = lang === undefined ? '/api/v1/ai-overview' : `/api/v1/ai-overview?lang=${lang}`;
    const response = await get(url);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    return validate(AiOverviewSchema, response.json());
  }

  async function cvOverview(lang: 'fr' | 'en'): Promise<AiOverview | null> {
    const response = await get(`/api/v1/cv?lang=${lang}`);
    expect(response.statusCode).toBe(200);
    return validate(CvSchema, response.json()).aiOverview;
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
    it('sert la section en français par défaut, avec ses deux compétences ordonnées', async () => {
      const fr = await overview();

      expect(fr).toMatchObject({
        title: 'L’IA, dans le produit et au quotidien',
        inProductLabel: 'dans le produit · Nopillo, 2026',
        dailyLabel: 'au quotidien',
      });
      expect(fr.inProductItems).toHaveLength(3);
      expect(fr.inProductItems[0]).toBe('OCR pour les tickets de caisse et les factures');
      expect(fr.dailyText).toMatch(/^Usage quotidien de l’IA/);
      expect(fr.skills.map((skill) => skill.slug)).toEqual(['mastra', 'agentic-development']);
      expect(await overview('fr')).toStrictEqual(fr);
    });

    it('?lang=en sert la ligne en entière, compétences comprises', async () => {
      const fr = await overview('fr');
      const en = await overview('en');

      expect(en.title).toBe('AI, in the product and day to day');
      expect(en.dailyLabel).toBe('day to day');
      expect(en.inProductItems).toHaveLength(3);
      for (const key of ['inProductLabel', 'dailyText'] as const) {
        expect(en[key], key).not.toBe(fr[key]);
      }
      expect(en.inProductItems).not.toEqual(fr.inProductItems);
      expect(en.skills.map((skill) => skill.slug)).toEqual(fr.skills.map((skill) => skill.slug));
    });

    it.each(['fr', 'en'] as const)('cv.aiOverview est égal à la route (lang=%s)', async (lang) => {
      expect(await cvOverview(lang)).toStrictEqual(await overview(lang));
    });

    it('?lang=de : 400 problem+json', async () => {
      const problem = expectProblem(await get('/api/v1/ai-overview?lang=de'), 400);

      expect(problem.instance).toBe('/api/v1/ai-overview?lang=de');
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
      '%s : 405 problem+json avec Allow',
      async (method) => {
        const response = await app.inject({ method, url: '/api/v1/ai-overview' });

        expectProblem(response, 405);
        expect(response.headers.allow).toBe('GET, HEAD, OPTIONS');
      },
    );
  });

  describe('contenu modifié par le test', () => {
    beforeEach(async () => {
      await resetTestDatabase();
    });

    it('sans ligne en, ?lang=en sert la ligne fr entière', async () => {
      await alter((sql) => sql`delete from ai_overview_translations where locale = 'en'`);

      const fr = await overview('fr');
      const en = await overview('en');

      expect(en.title).toBe('L’IA, dans le produit et au quotidien');
      const { skills: enSkills, ...enRest } = en;
      const { skills: frSkills, ...frRest } = fr;
      expect(enRest).toStrictEqual(frRest);
      // Les compétences gardent leur propre ligne de traduction.
      expect(enSkills.map((skill) => skill.slug)).toEqual(frSkills.map((skill) => skill.slug));
    });

    it('suit ai_overview_skills.sort_order', async () => {
      await alter(
        (sql) => sql`
          update ai_overview_skills set sort_order = 10
          where skill_id = (select id from skills where slug = 'mastra')`,
      );

      expect((await overview()).skills.map((skill) => skill.slug)).toEqual([
        'agentic-development',
        'mastra',
      ]);
    });

    it.each([
      ['non publiée', "update skills set published = false where slug = 'mastra'"],
      ['marquée deleted_at', "update skills set deleted_at = now() where slug = 'mastra'"],
      [
        'd’un groupe non publié',
        `update skill_groups set published = false
         where id = (select group_id from skills where slug = 'mastra')`,
      ],
    ])('écarte une compétence %s, de la route comme de /cv', async (_label, statement) => {
      await alter((sql) => sql.unsafe(statement));

      for (const lang of ['fr', 'en'] as const) {
        expect((await overview(lang)).skills.map((skill) => skill.slug)).not.toContain('mastra');
        expect((await cvOverview(lang))?.skills.map((skill) => skill.slug)).not.toContain('mastra');
      }
    });

    it.each([
      ['marquée deleted_at', 'update ai_overview set deleted_at = now()'],
      ['absente', 'delete from ai_overview'],
      ['sans traduction fr', "delete from ai_overview_translations where locale = 'fr'"],
    ])('section %s : 404 problem+json, et aiOverview null dans /cv', async (_label, statement) => {
      await alter((sql) => sql.unsafe(statement));

      for (const lang of ['fr', 'en'] as const) {
        const problem = expectProblem(await get(`/api/v1/ai-overview?lang=${lang}`), 404);
        expect(problem.detail).toBe('Section IA « ai-overview » introuvable.');
        expect(await cvOverview(lang)).toBeNull();
      }
    });
  });

  it('un dépôt en échec donne un 500 problem+json générique, route et /cv', async () => {
    const failing = await appWithOverrides([
      [
        AI_OVERVIEW_REPOSITORY,
        { findAiOverview: () => Promise.reject(new Error('secret-interne')) },
      ],
    ]);
    try {
      for (const url of ['/api/v1/ai-overview', '/api/v1/cv']) {
        const response = await failing.inject({ method: 'GET', url });

        expectProblem(response, 500);
        expect(response.body).not.toContain('secret-interne');
      }
    } finally {
      await failing.close();
    }
  });
});
