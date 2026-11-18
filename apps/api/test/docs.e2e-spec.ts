import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startTestApp } from './support/test-app.js';

interface OpenApiShape {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, unknown>;
  components?: { schemas?: Record<string, unknown> };
}

describe('GET /api/v1/docs.json', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sert le contrat OpenAPI 3.1 généré depuis @siteperso/contracts', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/docs.json' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');

    const document = response.json<OpenApiShape>();
    expect(document.openapi).toBe('3.1.0');
    expect(document.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Object.keys(document.paths)).toContain('/health');
    expect(Object.keys(document.components?.schemas ?? {})).toContain('ProblemDetails');
  });
});
