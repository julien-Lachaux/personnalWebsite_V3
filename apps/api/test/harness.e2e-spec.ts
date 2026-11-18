import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ENDPOINTS } from './support/endpoints.js';
import { withFixture } from './support/fixtures.js';
import { expectProblem } from './support/problem.js';
import { resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';
import { validate } from './support/validate.js';

/** Vérifie le harnais lui-même : les helpers doivent détecter ce qu'ils promettent de détecter. */
describe('Harnais e2e', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('ENDPOINTS décrit 12 routes distinctes, toutes en 200 sur la base seedée', async () => {
    expect(ENDPOINTS).toHaveLength(12);
    expect(new Set(ENDPOINTS.map((endpoint) => endpoint.path)).size).toBe(12);
    for (const endpoint of ENDPOINTS) {
      const response = await app.inject({ method: 'GET', url: endpoint.path });
      expect(response.statusCode, endpoint.path).toBe(200);
      const body = validate(endpoint.schema, response.json());
      if (endpoint.seededCount !== null) {
        expect(body, endpoint.path).toHaveLength(endpoint.seededCount);
      }
    }
  });

  it('validate refuse une clé inconnue même avec un schéma non strict', () => {
    const lax = z.object({ a: z.string() });
    expect(() => validate(lax, { a: 'x', extra: 1 })).toThrow();
    expect(validate(lax, { a: 'x' })).toEqual({ a: 'x' });
  });

  it('expectProblem valide un 404 problem+json et rejette un corps JSON simple', async () => {
    const problem = expectProblem(await app.inject({ method: 'GET', url: '/api/v1/inconnu' }), 404);
    expect(problem.instance).toBe('/api/v1/inconnu');

    const health = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(() => expectProblem(health, 200)).toThrow();
  });

  it('withFixture insère puis nettoie, même quand le test échoue', async () => {
    const insert = async (sql: Parameters<Parameters<typeof withFixture>[0]>[0]) => {
      await sql`insert into social_links (slug, kind, url) values ('qa-harnais', 'test', 'https://example.org')`;
      await sql`
        insert into social_links_translations (social_link_id, locale, label)
        select id, 'fr', 'Harnais' from social_links where slug = 'qa-harnais'`;
    };
    const slugs = async () =>
      (await app.inject({ method: 'GET', url: '/api/v1/social-links' }))
        .json<{ slug: string }[]>()
        .map((link) => link.slug);

    await withFixture(insert, async () => {
      expect(await slugs()).toContain('qa-harnais');
    });
    expect(await slugs()).not.toContain('qa-harnais');

    await expect(
      withFixture(insert, () => Promise.reject(new Error('échec voulu'))),
    ).rejects.toThrow('échec voulu');
    expect(await slugs()).not.toContain('qa-harnais');
  });
});
