import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { insertEmptySeedTablesFixtures } from './support/content-fixtures.js';
import { ENDPOINTS, TRANSLATION_TABLES, withLang } from './support/endpoints.js';
import { withFixture } from './support/fixtures.js';
import { expectProblem } from './support/problem.js';
import { resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';
import { validate } from './support/validate.js';

/** Retire la locale annoncée par `/cv` pour comparer deux langues champ par champ. */
function withoutLocale(body: unknown): unknown {
  if (typeof body === 'object' && body !== null && 'locale' in body) {
    const { locale: _locale, ...rest } = body;
    return rest;
  }
  return body;
}

describe('Matrice endpoints x langues', () => {
  let app: NestFastifyApplication;
  const previousMax = process.env['RATE_LIMIT_MAX'];

  beforeAll(async () => {
    // Plus d'une centaine de requêtes sur la même IP : le quota par défaut (100/min) est relevé.
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

  const get = (url: string) => app.inject({ method: 'GET', url });

  it('couvre les 14 routes', () => {
    expect(ENDPOINTS).toHaveLength(14);
  });

  describe.each(ENDPOINTS)('$path', (endpoint) => {
    it('sans lang : 200 conforme, identique à ?lang=fr', async () => {
      const implicit = await get(withLang(endpoint.path));
      const explicit = await get(withLang(endpoint.path, 'fr'));

      expect(implicit.statusCode).toBe(200);
      expect(implicit.headers['content-type']).toContain('application/json');
      validate(endpoint.schema, implicit.json());
      expect(explicit.statusCode).toBe(200);
      expect(implicit.json()).toStrictEqual(explicit.json());
    });

    it('?lang=fr : 200 conforme au contrat strict', async () => {
      const response = await get(withLang(endpoint.path, 'fr'));

      expect(response.statusCode).toBe(200);
      const body = validate(endpoint.schema, response.json());
      if (endpoint.seededCount !== null) {
        expect(body).toHaveLength(endpoint.seededCount);
      }
      if (endpoint.name === 'cv') {
        expect(response.json<{ locale: string }>().locale).toBe('fr');
      }
    });

    it('?lang=en : 200 conforme au contrat strict', async () => {
      const response = await get(withLang(endpoint.path, 'en'));

      expect(response.statusCode).toBe(200);
      const body = validate(endpoint.schema, response.json());
      if (endpoint.seededCount !== null) {
        expect(body).toHaveLength(endpoint.seededCount);
      }
      if (endpoint.name === 'cv') {
        expect(response.json<{ locale: string }>().locale).toBe('en');
      }
    });

    // P8 : le contrat est strict, `fr|en` en minuscules uniquement.
    it.each([
      ['EN', 'EN'],
      ['Fr', 'Fr'],
      ['de', 'de'],
      ['vide', ''],
    ])('?lang=%s (%s) : 400 problem+json', async (_label, value) => {
      const problem = expectProblem(await get(withLang(endpoint.path, value)), 400);

      expect(problem.title).toBe('Bad Request');
      expect(problem.instance).toBe(withLang(endpoint.path, value));
    });
  });

  it('répond 400 à un `lang` répété', async () => {
    expectProblem(await get('/api/v1/skills?lang=fr&lang=en'), 400);
  });

  it('ignore les paramètres de requête inconnus', async () => {
    const response = await get('/api/v1/skills?autre=1');

    expect(response.statusCode).toBe(200);
  });

  describe('repli en vers fr quand toutes les traductions en manquent', () => {
    it.each(ENDPOINTS)('$path : ?lang=en égal à ?lang=fr champ par champ', async (endpoint) => {
      await withFixture(
        async (sql) => {
          await insertEmptySeedTablesFixtures(sql);
          for (const table of TRANSLATION_TABLES) {
            await sql`delete from ${sql(table)} where locale = 'en'`;
          }
        },
        async () => {
          const fr = await get(withLang(endpoint.path, 'fr'));
          const en = await get(withLang(endpoint.path, 'en'));

          expect(fr.statusCode).toBe(200);
          expect(en.statusCode).toBe(200);
          validate(endpoint.schema, en.json());
          expect(withoutLocale(en.json())).toStrictEqual(withoutLocale(fr.json()));
          if (endpoint.shape === 'list') {
            expect(en.json<unknown[]>().length).toBeGreaterThan(0);
          }
        },
        { restoreSeed: true },
      );
    });
  });
});
