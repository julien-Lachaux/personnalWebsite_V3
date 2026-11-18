import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PROBLEM_JSON_CONTENT_TYPE, ProblemDetailsSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startTestApp } from './support/test-app.js';

/** Routes du contrat (docs/01) dont l'implémentation arrive au lot 3. */
const PENDING_RESOURCES = [
  'profile',
  'social-links',
  'skill-groups',
  'skills',
  'experiences',
  'projects',
  'tools',
  'resources',
  'certifications',
  'education',
  'languages',
  'cv',
];

describe('Erreurs au format RFC 9457 (problem+json)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(PENDING_RESOURCES)('GET /api/v1/%s répond 501 Not Implemented', async (resource) => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/${resource}` });

    expect(response.statusCode).toBe(501);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);

    const problem = ProblemDetailsSchema.parse(response.json());
    expect(problem.title).toBe('Not Implemented');
    expect(problem.status).toBe(501);
    expect(problem.instance).toBe(`/api/v1/${resource}`);
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
