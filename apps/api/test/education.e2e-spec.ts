import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  EducationSchema,
  PROBLEM_JSON_CONTENT_TYPE,
  ProblemDetailsSchema,
} from '@siteperso/contracts';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const EducationListSchema = EducationSchema.array();

describe('GET /api/v1/education', () => {
  let app: NestFastifyApplication;
  let sql: Sql;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end();
    await app.close();
    await resetTestDatabase();
  });

  const get = (url: string) => app.inject({ method: 'GET', url });

  it('renvoie les formations seedées triées par sort_order, validées par le contrat', async () => {
    const response = await get('/api/v1/education');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const education = EducationListSchema.parse(response.json());
    expect(education.length).toBeGreaterThanOrEqual(1);
    expect(education.map((item) => item.slug)).toEqual([
      'eemi',
      'openclassrooms-integrateur-web',
      'autodidacte',
    ]);
  });

  it('accepte yearEnd null (formation en cours) et une description absente', async () => {
    const education = EducationListSchema.parse((await get('/api/v1/education')).json());

    const autodidacte = education.find((item) => item.slug === 'autodidacte');
    expect(autodidacte?.yearEnd).toBeNull();
    expect(autodidacte?.yearStart).toBe(2015);
    // `openclassrooms-integrateur-web` n'a pas de description en base : chaîne vide dans le contrat.
    expect(
      education.find((item) => item.slug === 'openclassrooms-integrateur-web')?.description,
    ).toBe('');
  });

  it('?lang=en renvoie les textes anglais', async () => {
    const response = await get('/api/v1/education?lang=en');

    expect(response.statusCode).toBe(200);
    const education = EducationListSchema.parse(response.json());
    expect(education[0]?.title).toBe('Studies at EEMI');
    expect(education[2]?.title).toBe('Self-taught training');
  });

  it('?lang=en se replie sur le français quand la traduction anglaise est supprimée', async () => {
    await sql`delete from education_translations where locale = 'en'`;
    try {
      const fr = EducationListSchema.parse((await get('/api/v1/education')).json());
      const response = await get('/api/v1/education?lang=en');

      expect(response.statusCode).toBe(200);
      expect(EducationListSchema.parse(response.json())).toEqual(fr);
    } finally {
      await resetTestDatabase();
    }
  });

  it('exclut une formation non publiée', async () => {
    await sql`update education set published = false where slug = 'eemi'`;
    try {
      const education = EducationListSchema.parse((await get('/api/v1/education')).json());

      expect(education.map((item) => item.slug)).not.toContain('eemi');
    } finally {
      await sql`update education set published = true where slug = 'eemi'`;
    }
  });

  it('répond 400 problem+json pour une langue inconnue', async () => {
    const response = await get('/api/v1/education?lang=de');

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(ProblemDetailsSchema.parse(response.json()).status).toBe(400);
  });
});
