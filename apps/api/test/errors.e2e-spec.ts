import { type NestFastifyApplication } from '@nestjs/platform-fastify';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CERTIFICATIONS_REPOSITORY } from '../src/application/certifications/ports/certifications-repository.port.js';
import { DATABASE_CLIENT } from '../src/application/ports/database-client.port.js';
import { EDUCATION_REPOSITORY } from '../src/application/education/ports/education-repository.port.js';
import { EXPERIENCES_REPOSITORY } from '../src/application/experiences/ports/experiences-repository.port.js';
import { LANGUAGES_REPOSITORY } from '../src/application/languages/ports/languages-repository.port.js';
import { PROFILE_REPOSITORY } from '../src/application/profile/ports/profile-repository.port.js';
import { PROJECTS_REPOSITORY } from '../src/application/projects/ports/projects-repository.port.js';
import { RESOURCES_REPOSITORY } from '../src/application/resources/ports/resources-repository.port.js';
import { SKILL_GROUPS_REPOSITORY } from '../src/application/skill-groups/ports/skill-groups-repository.port.js';
import { SKILLS_REPOSITORY } from '../src/application/skills/ports/skills-repository.port.js';
import { SOCIAL_LINKS_REPOSITORY } from '../src/application/social-links/ports/social-links-repository.port.js';
import { TOOLS_REPOSITORY } from '../src/application/tools/ports/tools-repository.port.js';
import { appWithOverrides } from './support/override-app.js';
import { resetTestDatabase } from './support/database.js';
import { ALLOWED_ORIGIN, startTestApp } from './support/test-app.js';
import { expectNoLeak, expectProblem } from './support/problem.js';

/** Message volontairement piégé : il ressemble à une pile et à un secret. */
const SECRET = 'secret-interne-mot-de-passe';
const TRAP_MESSAGE = `${SECRET} at Object.run (/apps/api/src/infrastructure/db/x.ts:12:34)`;

/** Doublure de dépôt : toute méthode appelée lève l'erreur piégée. */
function throwingRepository(): object {
  return new Proxy(
    {},
    {
      get: (_target, property) =>
        typeof property !== 'string' || !property.startsWith('find')
          ? undefined
          : () => Promise.reject(new Error(TRAP_MESSAGE)),
    },
  );
}

const REPOSITORIES: [string, symbol][] = [
  ['profile', PROFILE_REPOSITORY],
  ['social-links', SOCIAL_LINKS_REPOSITORY],
  ['skill-groups', SKILL_GROUPS_REPOSITORY],
  ['skills', SKILLS_REPOSITORY],
  ['experiences', EXPERIENCES_REPOSITORY],
  ['projects', PROJECTS_REPOSITORY],
  ['tools', TOOLS_REPOSITORY],
  ['resources', RESOURCES_REPOSITORY],
  ['certifications', CERTIFICATIONS_REPOSITORY],
  ['education', EDUCATION_REPOSITORY],
  ['languages', LANGUAGES_REPOSITORY],
];

describe('Erreurs au format RFC 9457 (problem+json)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('404 : routes inconnues', () => {
    it.each([
      '/api/v1/inconnu',
      '/api/v1/profile/1',
      '/inconnu',
      '/',
      '/api/v2/cv',
      '/api/v1',
      '/api/v1/',
      '/api/v1/profile/',
      '/api/v1/PROFILE',
      '/api/v1/skills/typescript',
      '/api/v1/profile.json',
      '/api/v1/docs',
    ])('GET %s : 404 problem+json, instance = chemin demandé', async (url) => {
      const problem = expectProblem(await app.inject({ method: 'GET', url }), 404);

      expect(problem).toMatchObject({ type: 'about:blank', title: 'Not Found', instance: url });
    });

    it('garde la query string dans instance', async () => {
      const problem = expectProblem(
        await app.inject({ method: 'GET', url: '/api/v1/inconnu?a=1&lang=fr' }),
        404,
      );

      expect(problem.instance).toBe('/api/v1/inconnu?a=1&lang=fr');
    });
  });

  describe('méthodes autres que GET', () => {
    // Décision consignée : Nest/Fastify ne connaissent que les routes déclarées, donc une méthode
    // non déclarée donne 404 (« Cannot POST … »), pas 405. Pas d'en-tête `allow`.
    it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
      '%s /api/v1/profile : 404 problem+json (pas de 405 livré)',
      async (method) => {
        const response = await app.inject({ method, url: '/api/v1/profile' });

        const problem = expectProblem(response, 404);
        expect(problem.detail).toBe(`Cannot ${method} /api/v1/profile`);
        expect(response.headers.allow).toBeUndefined();
      },
    );

    it.each(['/api/v1/cv', '/api/v1/skills', '/api/v1/health', '/api/v1/docs.json'])(
      'POST %s : 404 sans exécuter de cas d’usage',
      async (url) => {
        expectProblem(await app.inject({ method: 'POST', url, payload: { a: 1 } }), 404);
      },
    );

    it('corps JSON invalide : 400 problem+json sans fuite', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/profile',
        headers: { 'content-type': 'application/json' },
        payload: '{bad',
      });

      expectProblem(response, 400);
    });
  });

  describe('HEAD et OPTIONS', () => {
    it('HEAD sur une route existante : 200, mêmes en-têtes qu’un GET, corps vide', async () => {
      const get = await app.inject({ method: 'GET', url: '/api/v1/profile' });
      const head = await app.inject({ method: 'HEAD', url: '/api/v1/profile' });

      expect(head.statusCode).toBe(200);
      expect(head.body).toBe('');
      expect(head.headers['content-type']).toBe(get.headers['content-type']);
      expect(head.headers['content-length']).toBe(get.headers['content-length']);
    });

    it('HEAD sur une route inconnue : 404 problem+json', async () => {
      const response = await app.inject({ method: 'HEAD', url: '/api/v1/inconnu' });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });

    it('HEAD avec ?lang=de : 400', async () => {
      const response = await app.inject({ method: 'HEAD', url: '/api/v1/profile?lang=de' });

      expect(response.statusCode).toBe(400);
    });

    it('préflight CORS valide (GET) : 204 avec origine et méthodes GET, HEAD, OPTIONS', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/profile',
        headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'GET' },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(response.headers['access-control-allow-methods']).toBe('GET, HEAD, OPTIONS');
    });

    it('préflight d’une route inconnue : 204 identique (CORS répond avant le routage)', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/inconnu',
        headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'GET' },
      });

      expect(response.statusCode).toBe(204);
    });

    // BUG-2 : OPTIONS sans en-têtes de préflight (curl -X OPTIONS) répond 400 `text/plain`
    // « Invalid Preflight Request » (@fastify/cors, strictPreflight), hors RFC 9457, sans les
    // en-têtes de sécurité de helmet. Attendu : un problem+json ou un 204.
    it.fails('BUG-2 : OPTIONS sans préflight répond en problem+json ou en 2xx', async () => {
      const response = await app.inject({ method: 'OPTIONS', url: '/api/v1/profile' });

      const isProblem = String(response.headers['content-type']).includes('problem+json');
      expect(isProblem || response.statusCode < 300).toBe(true);
    });
  });

  describe('erreurs levées par Fastify avant le routage', () => {
    // BUG-1 : une URL à pourcentage invalide est rejetée par Fastify (FST_ERR_BAD_URL) AVANT
    // le filtre Nest : corps `application/json` {statusCode, code, error, message}, sans
    // en-têtes de sécurité (helmet). Attendu : problem+json 400. Piste : `frameworkErrors`
    // du FastifyAdapter dans create-app.ts.
    it.fails('BUG-1 : une URL mal encodée (/api/v1/%zz) répond en problem+json', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/%zz' });

      expectProblem(response, 400);
    });

    it('une URL mal encodée répond tout de même 400 sans pile ni chemin', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/%zz' });

      expect(response.statusCode).toBe(400);
      expectNoLeak(response.body);
    });

    it('un paramètre lang mal encodé (?lang=%zz) donne 400 problem+json', async () => {
      expectProblem(await app.inject({ method: 'GET', url: '/api/v1/profile?lang=%zz' }), 400);
    });
  });

  it('ne laisse fuiter aucune pile dans une réponse d’erreur', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/inconnue' });

    expect(response.body).not.toContain('stack');
    expect(response.body).not.toContain('node_modules');
    expectNoLeak(response.body);
  });
});

describe('Erreurs 500 simulées (dépôt qui lève)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await appWithOverrides(REPOSITORIES.map(([, token]) => [token, throwingRepository()]));
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([...REPOSITORIES.map(([name]) => name), 'cv'])(
    '/api/v1/%s : 500 générique, sans message interne, ni pile, ni chemin',
    async (name) => {
      const url = `/api/v1/${name}`;
      const response = await app.inject({ method: 'GET', url });

      const problem = expectProblem(response, 500);
      expect(problem).toStrictEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Une erreur interne est survenue.',
        instance: url,
      });
      expect(response.body).not.toContain(SECRET);
    },
  );

  it('conserve instance = chemin et query demandés', async () => {
    const problem = expectProblem(
      await app.inject({ method: 'GET', url: '/api/v1/skills?lang=en' }),
      500,
    );

    expect(problem.instance).toBe('/api/v1/skills?lang=en');
  });

  it('les routes qui n’utilisent pas de dépôt restent disponibles (docs.json)', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/docs.json' })).statusCode).toBe(200);
  });
});

describe('Erreur de validation de réponse et base injoignable', () => {
  it('une réponse hors contrat (clé en trop) donne un 500 générique sans nom de champ', async () => {
    const app = await appWithOverrides([
      [
        PROFILE_REPOSITORY,
        {
          findProfile: () =>
            Promise.resolve({ firstName: 'Prénom', champInattendu: SECRET, location: 12 }),
        },
      ],
    ]);
    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/profile' });

      expectProblem(response, 500);
      expect(response.body).not.toContain('champInattendu');
      expect(response.body).not.toContain(SECRET);
    } finally {
      await app.close();
    }
  });

  it('une base injoignable donne 503 problem+json sans détail technique', async () => {
    const app = await appWithOverrides([[DATABASE_CLIENT, { ping: () => Promise.resolve(false) }]]);
    try {
      const problem = expectProblem(
        await app.inject({ method: 'GET', url: '/api/v1/health' }),
        503,
      );

      expect(problem).toMatchObject({ title: 'Service Unavailable', instance: '/api/v1/health' });
    } finally {
      await app.close();
    }
  });
});
