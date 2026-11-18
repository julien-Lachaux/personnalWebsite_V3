import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetTestDatabase } from './support/database.js';
import { emptyTestDatabase } from './support/empty-database.js';
import { ENDPOINTS, withLang } from './support/endpoints.js';
import { expectNoLeak, expectProblem } from './support/problem.js';
import { startTestApp } from './support/test-app.js';
import { validate } from './support/validate.js';

/**
 * Base migrée mais vide (aucun seed) : aucune route ne doit répondre 5xx. Comportement livré :
 * `profile` répond 404 problem+json, les listes `[]`, `cv` suit `profile` (404).
 */
describe('Base migrée mais vide', () => {
  let app: NestFastifyApplication;
  const previousMax = process.env['RATE_LIMIT_MAX'];

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX'] = '100000';
    await resetTestDatabase();
    await emptyTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
    if (previousMax === undefined) {
      delete process.env['RATE_LIMIT_MAX'];
    } else {
      process.env['RATE_LIMIT_MAX'] = previousMax;
    }
  });

  const LISTS = ENDPOINTS.filter((endpoint) => endpoint.shape === 'list');

  it.each(['fr', 'en', undefined])('aucune route ne répond 5xx (lang=%s)', async (lang) => {
    for (const endpoint of ENDPOINTS) {
      const response = await app.inject({ method: 'GET', url: withLang(endpoint.path, lang) });

      expect(response.statusCode, endpoint.path).toBeLessThan(500);
    }
    const health = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(health.statusCode).toBe(200);
  });

  it.each(['fr', 'en'])('GET /profile : 404 problem+json (lang=%s)', async (lang) => {
    const problem = expectProblem(
      await app.inject({ method: 'GET', url: withLang('/api/v1/profile', lang) }),
      404,
    );

    expect(problem.instance).toBe(withLang('/api/v1/profile', lang));
    expectNoLeak(JSON.stringify(problem));
  });

  it.each(LISTS)('GET $path : 200 avec un tableau vide', async (endpoint) => {
    for (const lang of ['fr', 'en']) {
      const response = await app.inject({ method: 'GET', url: withLang(endpoint.path, lang) });

      expect(response.statusCode).toBe(200);
      expect(validate(endpoint.schema, response.json())).toEqual([]);
    }
  });

  it('GET /cv : 404 problem+json, sans CV partiel (profil absent)', async () => {
    const problem = expectProblem(await app.inject({ method: 'GET', url: '/api/v1/cv' }), 404);

    expect(problem.instance).toBe('/api/v1/cv');
  });

  it('GET /docs.json reste servi', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/docs.json' })).statusCode).toBe(200);
  });
});
