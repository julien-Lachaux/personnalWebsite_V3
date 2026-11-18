import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PROBLEM_JSON_CONTENT_TYPE, ProblemDetailsSchema, ToolSchema } from '@siteperso/contracts';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const ToolsSchema = ToolSchema.array();

describe('GET /api/v1/tools', () => {
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

  it('renvoie [] sur la base seedée (aucun outil)', async () => {
    const response = await get('/api/v1/tools');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual([]);
  });

  it('répond 400 problem+json pour une langue inconnue', async () => {
    const response = await get('/api/v1/tools?lang=de');

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(ProblemDetailsSchema.parse(response.json()).status).toBe(400);
  });

  describe('avec des fixtures', () => {
    beforeAll(async () => {
      // « editeur » (sort_order 1) : fr seul ; « api-client » (2) : fr + en, sans url ni icône ;
      // « cache » (0) : non publié.
      await sql`
        insert into tools (slug, url, icon_path, sort_order, published)
        values
          ('api-client', null, null, 2, true),
          ('editeur', 'https://example.org/editeur', '/images/tools/editeur.svg', 1, true),
          ('cache', null, null, 0, false)`;
      await sql`
        insert into tools_translations (tool_id, locale, name, family, description)
        select id, 'fr', 'Nom FR ' || slug, 'Famille FR', 'Description FR ' || slug from tools`;
      await sql`
        insert into tools_translations (tool_id, locale, name, family, description)
        select id, 'en', 'Name EN api-client', 'Family EN', 'Description EN api-client'
        from tools where slug = 'api-client'`;
    });

    it('renvoie les outils publiés triés par sort_order, validés par ToolSchema', async () => {
      const response = await get('/api/v1/tools');

      expect(response.statusCode).toBe(200);
      const tools = ToolsSchema.parse(response.json());
      expect(tools.map((tool) => tool.slug)).toEqual(['editeur', 'api-client']);
      expect(tools[0]).toEqual({
        slug: 'editeur',
        url: 'https://example.org/editeur',
        iconPath: '/images/tools/editeur.svg',
        name: 'Nom FR editeur',
        family: 'Famille FR',
        description: 'Description FR editeur',
      });
      expect(tools[1]).toMatchObject({ url: null, iconPath: null });
    });

    it('exclut un outil non publié', async () => {
      const tools = ToolsSchema.parse((await get('/api/v1/tools')).json());

      expect(tools.map((tool) => tool.slug)).not.toContain('cache');
    });

    it('?lang=en : traduction anglaise si présente, repli sur le français sinon', async () => {
      const response = await get('/api/v1/tools?lang=en');

      expect(response.statusCode).toBe(200);
      const tools = ToolsSchema.parse(response.json());
      expect(tools[0]?.name).toBe('Nom FR editeur');
      expect(tools[1]).toMatchObject({
        name: 'Name EN api-client',
        family: 'Family EN',
        description: 'Description EN api-client',
      });
    });

    it('?lang=fr renvoie le français même si une version anglaise existe', async () => {
      const tools = ToolsSchema.parse((await get('/api/v1/tools?lang=fr')).json());

      expect(tools[1]?.name).toBe('Nom FR api-client');
    });
  });
});
