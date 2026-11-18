import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  PROBLEM_JSON_CONTENT_TYPE,
  ProblemDetailsSchema,
  ResourceSchema,
} from '@siteperso/contracts';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const ResourcesSchema = ResourceSchema.array();

describe('GET /api/v1/resources', () => {
  let app: NestFastifyApplication;
  let sql: Sql;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
    sql = openTestSql();
  });

  afterAll(async () => {
    await sql.end();
    await app.close();
    await resetTestDatabase();
  });

  const get = (url: string) => app.inject({ method: 'GET', url });

  it('renvoie [] sur la base seedée (aucune ressource)', async () => {
    const response = await get('/api/v1/resources');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual([]);
  });

  it('répond 400 problem+json pour une langue inconnue', async () => {
    const response = await get('/api/v1/resources?lang=de');

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(ProblemDetailsSchema.parse(response.json()).status).toBe(400);
  });

  describe('avec des fixtures', () => {
    beforeAll(async () => {
      // « avec-groupe » (sort_order 1) : fr seul, rattachée à un groupe seedé, avec image ;
      // « sans-groupe » (2) : fr + en, sans groupe ni image ; « cache » (0) : non publiée.
      await sql`
        insert into resources (slug, url, group_id, picture_path, sort_order, published)
        values
          ('sans-groupe', 'https://example.org/b', null, null, 2, true),
          ('avec-groupe', 'https://example.org/a',
            (select id from skill_groups where slug = 'languages-frameworks'),
            '/images/resources/a.webp', 1, true),
          ('cache', 'https://example.org/c', null, null, 0, false)`;
      await sql`
        insert into resources_translations (resource_id, locale, name, description, picture_alt)
        select id, 'fr', 'Nom FR ' || slug, 'Description FR ' || slug,
          case when slug = 'avec-groupe' then 'Alternative FR' else null end
        from resources`;
      await sql`
        insert into resources_translations (resource_id, locale, name, description, picture_alt)
        select id, 'en', 'Name EN sans-groupe', 'Description EN sans-groupe', null
        from resources where slug = 'sans-groupe'`;
    });

    it('renseigne groupSlug par jointure, null sans groupe, validé par ResourceSchema', async () => {
      const response = await get('/api/v1/resources');

      expect(response.statusCode).toBe(200);
      const resources = ResourcesSchema.parse(response.json());
      expect(resources.map((resource) => resource.slug)).toEqual(['avec-groupe', 'sans-groupe']);
      expect(resources[0]).toEqual({
        slug: 'avec-groupe',
        url: 'https://example.org/a',
        groupSlug: 'languages-frameworks',
        picture: { path: '/images/resources/a.webp', alt: 'Alternative FR' },
        name: 'Nom FR avec-groupe',
        description: 'Description FR avec-groupe',
      });
      expect(resources[1]).toMatchObject({ groupSlug: null, picture: null });
    });

    it('exclut une ressource non publiée', async () => {
      const resources = ResourcesSchema.parse((await get('/api/v1/resources')).json());

      expect(resources.map((resource) => resource.slug)).not.toContain('cache');
    });

    it('?lang=en : traduction anglaise si présente, repli sur le français sinon', async () => {
      const response = await get('/api/v1/resources?lang=en');

      expect(response.statusCode).toBe(200);
      const resources = ResourcesSchema.parse(response.json());
      expect(resources[0]?.name).toBe('Nom FR avec-groupe');
      expect(resources[0]?.picture?.alt).toBe('Alternative FR');
      expect(resources[1]).toMatchObject({
        name: 'Name EN sans-groupe',
        description: 'Description EN sans-groupe',
      });
    });

    it("groupSlug vaut null quand le groupe rattaché n'est pas publié", async () => {
      await sql`update skill_groups set published = false where slug = 'languages-frameworks'`;
      try {
        const resources = ResourcesSchema.parse((await get('/api/v1/resources')).json());

        expect(resources.map((resource) => resource.slug)).toEqual(['avec-groupe', 'sans-groupe']);
        expect(resources[0]?.groupSlug).toBeNull();
      } finally {
        await sql`update skill_groups set published = true where slug = 'languages-frameworks'`;
      }
      const restored = ResourcesSchema.parse((await get('/api/v1/resources')).json());
      expect(restored[0]?.groupSlug).toBe('languages-frameworks');
    });

    it('?lang=fr renvoie le français même si une version anglaise existe', async () => {
      const resources = ResourcesSchema.parse((await get('/api/v1/resources?lang=fr')).json());

      expect(resources[1]?.name).toBe('Nom FR sans-groupe');
    });
  });
});
