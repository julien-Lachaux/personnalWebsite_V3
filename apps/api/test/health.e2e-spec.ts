import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { HealthResponseSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startTestApp } from './support/test-app.js';

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

  // En-têtes de sécurité, CORS et préflight : couverts pour toutes les routes par security.e2e-spec.ts.
});
