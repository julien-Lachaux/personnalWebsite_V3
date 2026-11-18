import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ENDPOINTS } from './support/endpoints.js';
import { expectProblem } from './support/problem.js';
import { resetTestDatabase } from './support/database.js';
import { ALLOWED_ORIGIN, startTestApp } from './support/test-app.js';

/** Variables d'environnement lues par `createApp` : posées avant `startTestApp`, restaurées après. */
async function withEnv<T>(
  values: Record<string, string>,
  body: (app: NestFastifyApplication) => Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  let app: NestFastifyApplication | undefined;
  try {
    await resetTestDatabase();
    app = await startTestApp();
    return await body(app);
  } finally {
    await app?.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

/** Les 12 routes de contenu, la santé et le contrat OpenAPI. */
const ALL_PATHS = [
  ...ENDPOINTS.map((endpoint) => endpoint.path),
  '/api/v1/health',
  '/api/v1/docs.json',
];

describe('En-têtes de sécurité', () => {
  let app: NestFastifyApplication;
  const previousMax = process.env['RATE_LIMIT_MAX'];

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX'] = '100000';
    await resetTestDatabase();
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

  it.each(ALL_PATHS)('%s : en-têtes helmet présents, aucune fuite de technologie', async (path) => {
    const { headers, statusCode } = await app.inject({ method: 'GET', url: path });

    expect(statusCode).toBe(200);
    expect(headers['x-content-type-options']).toBe('nosniff');
    // Livré : SAMEORIGIN (défaut helmet). Décision ouverte P9 : DENY ; ce test serait à ajuster.
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['strict-transport-security']).toMatch(/^max-age=\d+/u);
    expect(headers['x-powered-by']).toBeUndefined();
    // Pas de `server` du tout (Fastify n'en émet pas) : ni nom ni version de la pile.
    expect(headers.server).toBeUndefined();
    // Choix du lot 0 : API JSON, pas de CSP. Si P9 en impose une, inverser cette assertion.
    expect(headers['content-security-policy']).toBeUndefined();
  });

  it('les réponses d’erreur applicatives gardent les en-têtes de sécurité', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/skills?lang=de' });

    expectProblem(response, 400);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('une 404 garde aussi les en-têtes de sécurité', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/inconnu' });

    expectProblem(response, 404);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toMatch(/^max-age=\d+/u);
  });

  it('les réponses de contenu sont servies en application/json (pas de type sniffable)', async () => {
    for (const endpoint of ENDPOINTS) {
      const response = await app.inject({ method: 'GET', url: endpoint.path });

      expect(response.headers['content-type'], endpoint.path).toBe(
        'application/json; charset=utf-8',
      );
    }
  });
});

describe('CORS', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX'] = '100000';
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env['RATE_LIMIT_MAX'];
  });

  const withOrigin = (url: string, origin: string) =>
    app.inject({ method: 'GET', url, headers: { origin } });

  it.each(ALL_PATHS)('%s : l’origine configurée est renvoyée à l’identique', async (path) => {
    const response = await withOrigin(path, ALLOWED_ORIGIN);

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(response.headers.vary).toContain('Origin');
  });

  it.each([
    'https://evil.example',
    `${ALLOWED_ORIGIN}.evil.example`,
    ALLOWED_ORIGIN.replace('http://', 'https://'),
    `${ALLOWED_ORIGIN}/`,
    'null',
  ])('l’origine %s est refusée (pas d’access-control-allow-origin)', async (origin) => {
    const response = await withOrigin('/api/v1/health', origin);

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sans en-tête Origin : pas d’en-tête CORS', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('n’autorise jamais les credentials', async () => {
    const response = await withOrigin('/api/v1/profile', ALLOWED_ORIGIN);

    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('une erreur 404 porte aussi l’en-tête CORS pour l’origine autorisée', async () => {
    const response = await withOrigin('/api/v1/inconnu', ALLOWED_ORIGIN);

    expectProblem(response, 404);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  describe('préflight OPTIONS', () => {
    const preflight = (origin: string, method: string) =>
      app.inject({
        method: 'OPTIONS',
        url: '/api/v1/profile',
        headers: { origin, 'access-control-request-method': method },
      });

    it('n’annonce que GET, HEAD et OPTIONS', async () => {
      const response = await preflight(ALLOWED_ORIGIN, 'GET');

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-methods']).toBe('GET, HEAD, OPTIONS');
      expect(response.headers['access-control-max-age']).toBe('600');
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      'ne mentionne jamais %s dans les méthodes autorisées',
      async (method) => {
        const response = await preflight(ALLOWED_ORIGIN, method);

        expect(String(response.headers['access-control-allow-methods'])).not.toContain(method);
      },
    );

    it('une origine inconnue ne reçoit aucun access-control-allow-origin', async () => {
      const response = await preflight('https://evil.example', 'GET');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('plusieurs origines configurées', () => {
    it('autorise chacune des origines de CORS_ORIGIN et aucune autre', async () => {
      await withEnv(
        {
          CORS_ORIGIN: 'http://a.example:3001, https://b.example',
          RATE_LIMIT_MAX: '100000',
        },
        async (multi) => {
          const origin = async (value: string) =>
            (
              await multi.inject({
                method: 'GET',
                url: '/api/v1/health',
                headers: { origin: value },
              })
            ).headers['access-control-allow-origin'];

          expect(await origin('http://a.example:3001')).toBe('http://a.example:3001');
          expect(await origin('https://b.example')).toBe('https://b.example');
          expect(await origin('https://c.example')).toBeUndefined();
        },
      );
    });
  });
});

describe('Rate limiting sur les routes de contenu', () => {
  const MAX = 3;

  it(`la requête ${MAX + 1} dans la fenêtre : 429 problem+json avec retry-after`, async () => {
    await withEnv({ RATE_LIMIT_MAX: String(MAX), RATE_LIMIT_WINDOW_MS: '60000' }, async (app) => {
      for (let count = 1; count <= MAX; count += 1) {
        const ok = await app.inject({ method: 'GET', url: '/api/v1/profile' });
        expect(ok.statusCode).toBe(200);
        expect(ok.headers['x-ratelimit-remaining']).toBe(String(MAX - count));
      }

      const limited = await app.inject({ method: 'GET', url: '/api/v1/profile' });

      const problem = expectProblem(limited, 429);
      expect(problem).toMatchObject({ title: 'Too Many Requests', instance: '/api/v1/profile' });
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
      expect(Number(limited.headers['retry-after'])).toBeLessThanOrEqual(60);
      expect(limited.headers['x-ratelimit-remaining']).toBe('0');
      // Le 429 garde les en-têtes de sécurité.
      expect(limited.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  it('le quota est partagé entre toutes les routes de contenu de la même IP', async () => {
    await withEnv({ RATE_LIMIT_MAX: String(MAX) }, async (app) => {
      await app.inject({ method: 'GET', url: '/api/v1/skills' });
      await app.inject({ method: 'GET', url: '/api/v1/cv' });
      await app.inject({ method: 'GET', url: '/api/v1/health' });

      expectProblem(await app.inject({ method: 'GET', url: '/api/v1/languages' }), 429);
    });
  });

  // BUG-3 : les routes inconnues (404) ne sont pas comptées par @fastify/rate-limit, qui ne
  // s'accroche qu'aux routes déclarées : un client peut les marteler sans jamais recevoir de 429.
  // Impact faible (réponse minuscule, aucun accès base), mais le quota « global » ne l'est pas.
  it.fails('BUG-3 : les requêtes 404 consomment aussi le quota par IP', async () => {
    await withEnv({ RATE_LIMIT_MAX: String(MAX) }, async (app) => {
      for (let count = 0; count < MAX + 2; count += 1) {
        await app.inject({ method: 'GET', url: '/api/v1/inconnu' });
      }

      expectProblem(await app.inject({ method: 'GET', url: '/api/v1/inconnu' }), 429);
    });
  });

  it('une requête en 400 consomme aussi le quota', async () => {
    await withEnv({ RATE_LIMIT_MAX: String(MAX) }, async (app) => {
      for (let count = 0; count < MAX; count += 1) {
        expectProblem(await app.inject({ method: 'GET', url: '/api/v1/skills?lang=de' }), 400);
      }

      expectProblem(await app.inject({ method: 'GET', url: '/api/v1/skills' }), 429);
    });
  });

  it('une autre adresse IP a son propre quota', async () => {
    await withEnv({ RATE_LIMIT_MAX: String(MAX) }, async (app) => {
      for (let count = 0; count < MAX + 1; count += 1) {
        await app.inject({ method: 'GET', url: '/api/v1/skills' });
      }

      const other = await app.inject({
        method: 'GET',
        url: '/api/v1/skills',
        remoteAddress: '203.0.113.9',
      });
      expect(other.statusCode).toBe(200);
    });
  });

  it('X-Forwarded-For est ignoré sans TRUST_PROXY (pas de contournement du quota)', async () => {
    await withEnv({ RATE_LIMIT_MAX: String(MAX), TRUST_PROXY: 'false' }, async (app) => {
      for (let count = 0; count < MAX; count += 1) {
        await app.inject({
          method: 'GET',
          url: '/api/v1/skills',
          headers: { 'x-forwarded-for': `198.51.100.${count}` },
        });
      }

      const spoofed = await app.inject({
        method: 'GET',
        url: '/api/v1/skills',
        headers: { 'x-forwarded-for': '198.51.100.200' },
      });
      expectProblem(spoofed, 429);
    });
  });

  it('avec TRUST_PROXY=true, l’IP du client vient de X-Forwarded-For', async () => {
    await withEnv({ RATE_LIMIT_MAX: String(MAX), TRUST_PROXY: 'true' }, async (app) => {
      for (let count = 0; count < MAX; count += 1) {
        await app.inject({
          method: 'GET',
          url: '/api/v1/skills',
          headers: { 'x-forwarded-for': '198.51.100.1' },
        });
      }

      const sameClient = await app.inject({
        method: 'GET',
        url: '/api/v1/skills',
        headers: { 'x-forwarded-for': '198.51.100.1' },
      });
      const otherClient = await app.inject({
        method: 'GET',
        url: '/api/v1/skills',
        headers: { 'x-forwarded-for': '198.51.100.2' },
      });

      expectProblem(sameClient, 429);
      expect(otherClient.statusCode).toBe(200);
    });
  });
});
