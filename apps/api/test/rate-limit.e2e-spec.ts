import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PROBLEM_JSON_CONTENT_TYPE, ProblemDetailsSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startTestApp } from './support/test-app.js';

/** Seuil volontairement bas pour atteindre le 429 en quelques requêtes. */
const MAX = 3;

describe('Rate limiting global', () => {
  let app: NestFastifyApplication;
  const previousMax = process.env['RATE_LIMIT_MAX'];

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX'] = String(MAX);
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    if (previousMax === undefined) {
      delete process.env['RATE_LIMIT_MAX'];
    } else {
      process.env['RATE_LIMIT_MAX'] = previousMax;
    }
  });

  it('annonce le quota dans les en-têtes x-ratelimit-* et le décrémente', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(first.statusCode).toBe(200);
    expect(first.headers['x-ratelimit-limit']).toBe(String(MAX));
    expect(first.headers['x-ratelimit-remaining']).toBe(String(MAX - 1));
    expect(Number(first.headers['x-ratelimit-reset'])).toBeGreaterThan(0);

    const second = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(second.headers['x-ratelimit-remaining']).toBe(String(MAX - 2));
  });

  it('répond 429 problem+json avec retry-after une fois le quota épuisé', async () => {
    // Le quota est partagé avec le test précédent (même IP, même fenêtre) : on l'épuise.
    let response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    while (response.statusCode === 200) {
      response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    }

    expect(response.statusCode).toBe(429);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(response.headers['x-ratelimit-remaining']).toBe('0');
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(ProblemDetailsSchema.parse(response.json())).toMatchObject({
      type: 'about:blank',
      title: 'Too Many Requests',
      status: 429,
      instance: '/api/v1/health',
    });
    expect(response.body).not.toContain('stack');
  });

  it('compte les requêtes par adresse IP', async () => {
    const other = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      remoteAddress: '203.0.113.7',
    });

    expect(other.statusCode).toBe(200);
    expect(other.headers['x-ratelimit-remaining']).toBe(String(MAX - 1));
  });
});
