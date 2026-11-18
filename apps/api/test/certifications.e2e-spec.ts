import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  CertificationSchema,
  PROBLEM_JSON_CONTENT_TYPE,
  ProblemDetailsSchema,
} from '@siteperso/contracts';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const CertificationsSchema = CertificationSchema.array();

describe('GET /api/v1/certifications', () => {
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

  it('renvoie les 3 certifications seedées triées par sort_order, validées par le contrat', async () => {
    const response = await get('/api/v1/certifications');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const certifications = CertificationsSchema.parse(response.json());
    expect(certifications.map((certification) => certification.slug)).toEqual([
      'contentsquare-certified',
      'ef-set-plus-62',
      'openclassrooms-integrateur-web',
    ]);
    expect(certifications[1]).toMatchObject({
      issuer: 'EF SET',
      year: 2015,
      url: null,
      name: 'EF SET Plus 62, anglais C1',
    });
  });

  it('?lang=en renvoie les noms anglais', async () => {
    const response = await get('/api/v1/certifications?lang=en');

    expect(response.statusCode).toBe(200);
    const certifications = CertificationsSchema.parse(response.json());
    expect(certifications).toHaveLength(3);
    expect(certifications[1]?.name).toBe('EF SET Plus 62, English C1');
    expect(certifications[2]?.name).toBe('Web Integrator');
  });

  it('?lang=en se replie sur le français quand la traduction anglaise est supprimée', async () => {
    await sql`delete from certifications_translations where locale = 'en'`;
    try {
      const fr = CertificationsSchema.parse((await get('/api/v1/certifications')).json());
      const response = await get('/api/v1/certifications?lang=en');

      expect(response.statusCode).toBe(200);
      expect(CertificationsSchema.parse(response.json())).toEqual(fr);
    } finally {
      await resetTestDatabase();
    }
  });

  it('exclut une certification non publiée', async () => {
    await sql`update certifications set published = false where slug = 'ef-set-plus-62'`;
    try {
      const certifications = CertificationsSchema.parse(
        (await get('/api/v1/certifications')).json(),
      );

      expect(certifications.map((certification) => certification.slug)).toEqual([
        'contentsquare-certified',
        'openclassrooms-integrateur-web',
      ]);
    } finally {
      await sql`update certifications set published = true where slug = 'ef-set-plus-62'`;
    }
  });

  it('répond 400 problem+json pour une langue inconnue', async () => {
    const response = await get('/api/v1/certifications?lang=de');

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(ProblemDetailsSchema.parse(response.json()).status).toBe(400);
  });
});
