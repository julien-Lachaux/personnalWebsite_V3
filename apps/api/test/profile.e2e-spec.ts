import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  PROBLEM_JSON_CONTENT_TYPE,
  ProblemDetailsSchema,
  ProfileSchema,
} from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

describe('GET /api/v1/profile', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  it('répond 200 en français par défaut, corps validé par le contrat strict', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/profile' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const profile = ProfileSchema.parse(response.json());
    expect(profile.title).toBe('Développeur full-stack TypeScript senior');
    expect(profile.picture.alt).not.toBe('');
  });

  it('?lang=en renvoie le titre en anglais', async () => {
    const fr = ProfileSchema.parse(
      (await app.inject({ method: 'GET', url: '/api/v1/profile?lang=fr' })).json(),
    );
    const response = await app.inject({ method: 'GET', url: '/api/v1/profile?lang=en' });

    expect(response.statusCode).toBe(200);
    const en = ProfileSchema.parse(response.json());
    expect(en.title).not.toBe(fr.title);
    expect(en.title).toMatch(/full-stack/i);
    expect(en.firstName).toBe(fr.firstName);
  });

  it('?lang=de répond 400 problem+json', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/profile?lang=de' });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(ProblemDetailsSchema.parse(response.json()).status).toBe(400);
  });

  it('ne contient ni e-mail ni téléphone', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/profile' });

    expect(response.body).not.toMatch(/@/);
    expect(response.body).not.toMatch(/\+?\d[\d .-]{8,}\d/);
  });

  describe('contenu modifié par le test', () => {
    // Base propre avant de la modifier ; les cas suivants sont ordonnés (repli, puis suppression).
    beforeAll(async () => {
      await resetTestDatabase();
    });

    it('sans ligne en, ?lang=en renvoie le français (repli)', async () => {
      const sql = openTestSql();
      try {
        await sql`delete from profile_translations where locale = 'en'`;
      } finally {
        await sql.end();
      }

      const fr = ProfileSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/profile?lang=fr' })).json(),
      );
      const response = await app.inject({ method: 'GET', url: '/api/v1/profile?lang=en' });

      expect(response.statusCode).toBe(200);
      expect(ProfileSchema.parse(response.json())).toEqual(fr);
    });

    it('sans ligne de profil, répond 404 problem+json', async () => {
      const sql = openTestSql();
      try {
        await sql`delete from profile`;
      } finally {
        await sql.end();
      }

      const response = await app.inject({ method: 'GET', url: '/api/v1/profile' });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
      expect(ProblemDetailsSchema.parse(response.json()).status).toBe(404);
    });
  });
});
