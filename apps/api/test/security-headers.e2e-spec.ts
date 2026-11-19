import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetTestDatabase } from './support/database.js';
import { ALLOWED_ORIGIN, startTestApp } from './support/test-app.js';

/** Politique posée par l'API ; Caddy (docker/Caddyfile) ne fait que la doubler, sans la contredire. */
const API_CSP = "default-src 'none';frame-ancestors 'none'";

/**
 * DEC-3 (docs/01, docs/02) : `X-Frame-Options: DENY` et la politique de sécurité de contenu sont
 * posés par l'API sur toutes ses réponses, succès comme erreurs, y compris celles que helmet ne voit
 * pas (erreurs de Fastify avant le routage).
 */
describe('X-Frame-Options et Content-Security-Policy posés par l’API', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const cases: [string, 'GET' | 'HEAD' | 'POST' | 'OPTIONS', string, number][] = [
    ['200', 'GET', '/api/v1/profile', 200],
    ['HEAD 200', 'HEAD', '/api/v1/profile', 200],
    ['400 (lang invalide)', 'GET', '/api/v1/skills?lang=de', 400],
    ['404', 'GET', '/api/v1/inconnu', 404],
    ['405', 'POST', '/api/v1/profile', 405],
    ['204 (OPTIONS)', 'OPTIONS', '/api/v1/profile', 204],
    ['400 (URL mal encodée, avant le routage)', 'GET', '/api/v1/%zz', 400],
  ];

  it.each(cases)('%s : DENY et CSP identique', async (_label, method, url, status) => {
    const response = await app.inject({ method, url });

    expect(response.statusCode).toBe(status);
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toBe(API_CSP);
  });

  it('un seul X-Frame-Options et une seule CSP (pas d’en-tête double divergent)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/profile',
      headers: { origin: ALLOWED_ORIGIN },
    });

    expect(Array.isArray(response.headers['x-frame-options'])).toBe(false);
    expect(Array.isArray(response.headers['content-security-policy'])).toBe(false);
  });
});
