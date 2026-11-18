import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PROBLEM_JSON_CONTENT_TYPE, ProblemDetailsSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startTestApp } from './support/test-app.js';

describe('Erreurs au format RFC 9457 (problem+json)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('répond 404 problem+json pour une route inconnue sous le préfixe', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/inconnue' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(ProblemDetailsSchema.parse(response.json())).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      instance: '/api/v1/inconnue',
    });
  });

  it('répond 404 problem+json hors du préfixe /api/v1', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(ProblemDetailsSchema.parse(response.json()).status).toBe(404);
  });

  it('ne laisse fuiter aucune pile dans une réponse d’erreur', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/inconnue' });

    expect(response.body).not.toContain('stack');
    expect(response.body).not.toContain('node_modules');
  });
});
