import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { HealthResponseSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ALLOWED_ORIGIN, startTestApp } from './support/test-app.js';

describe('GET /api/v1/health', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('répond 200 avec la base de test joignable', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(HealthResponseSchema.parse(response.json())).toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
  });

  it('envoie les en-têtes de sécurité de helmet', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['strict-transport-security']).toContain('max-age=');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it("autorise CORS uniquement pour l'origine configurée", async () => {
    const allowed = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: ALLOWED_ORIGIN },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);

    const refused = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://inconnu.example' },
    });
    expect(refused.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('refuse les méthodes autres que GET en préflight CORS', async () => {
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: {
        origin: ALLOWED_ORIGIN,
        'access-control-request-method': 'POST',
      },
    });

    expect(preflight.headers['access-control-allow-methods']).not.toContain('POST');
  });
});
