import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  PROBLEM_JSON_CONTENT_TYPE,
  ProblemDetailsSchema,
  ProjectSchema,
} from '@siteperso/contracts';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const ProjectsSchema = ProjectSchema.array();

describe('GET /api/v1/projects', () => {
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

  it('renvoie [] sur la base seedée (aucun projet)', async () => {
    const response = await get('/api/v1/projects');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual([]);
  });

  it('répond 400 problem+json pour une langue inconnue', async () => {
    const response = await get('/api/v1/projects?lang=de');

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(ProblemDetailsSchema.parse(response.json()).status).toBe(400);
  });

  describe('avec des fixtures', () => {
    beforeAll(async () => {
      // « premier » (sort_order 1) : fr seul, 2 compétences dont l'ordre de lien inverse l'id.
      // « second » (sort_order 2) : fr + en, sans image ni année. « cache » : non publié.
      await sql`
        insert into projects (slug, url, repo_url, image_desktop_path, image_mobile_path, year, sort_order, published)
        values
          ('second', null, null, null, null, null, 2, true),
          ('premier', 'https://example.org/premier', null, '/images/projects/premier-desktop.webp', '/images/projects/premier-mobile.webp', 2025, 1, true),
          ('cache', null, null, null, null, 2023, 0, false)`;
      await sql`
        insert into projects_translations (project_id, locale, title, description, image_alt)
        select id, 'fr', 'Titre FR ' || slug, 'Description FR ' || slug,
          case when slug = 'premier' then 'Capture FR' else null end
        from projects`;
      await sql`
        insert into projects_translations (project_id, locale, title, description, image_alt)
        select id, 'en', 'Title EN second', 'Description EN second', null
        from projects where slug = 'second'`;
      await sql`
        insert into project_skills (project_id, skill_id, sort_order)
        select p.id, s.id, case s.slug when 'nodejs' then 1 else 2 end
        from projects p, skills s
        where p.slug = 'premier' and s.slug in ('typescript', 'nodejs')`;
    });

    it('renvoie les projets publiés triés, validés par ProjectSchema', async () => {
      const response = await get('/api/v1/projects');

      expect(response.statusCode).toBe(200);
      const projects = ProjectsSchema.parse(response.json());
      expect(projects.map((project) => project.slug)).toEqual(['premier', 'second']);
      expect(projects[0]).toMatchObject({
        url: 'https://example.org/premier',
        repoUrl: null,
        year: 2025,
        title: 'Titre FR premier',
        imageDesktop: { path: '/images/projects/premier-desktop.webp', alt: 'Capture FR' },
        imageMobile: { path: '/images/projects/premier-mobile.webp', alt: 'Capture FR' },
      });
      expect(projects[1]).toMatchObject({
        url: null,
        year: null,
        imageDesktop: null,
        imageMobile: null,
      });
    });

    it('trie les compétences par project_skills.sort_order', async () => {
      const projects = ProjectsSchema.parse((await get('/api/v1/projects')).json());

      expect(projects[0]?.skills.map((skill) => skill.slug)).toEqual(['nodejs', 'typescript']);
      expect(projects[0]?.skills[1]).toMatchObject({
        name: 'TypeScript',
        groupSlug: 'languages-frameworks',
      });
      expect(projects[1]?.skills).toEqual([]);
    });

    it('?lang=en : repli sur le français quand la traduction anglaise manque', async () => {
      const response = await get('/api/v1/projects?lang=en');

      expect(response.statusCode).toBe(200);
      const projects = ProjectsSchema.parse(response.json());
      expect(projects[0]?.title).toBe('Titre FR premier');
      expect(projects[0]?.imageDesktop?.alt).toBe('Capture FR');
      expect(projects[1]?.title).toBe('Title EN second');
      expect(projects[1]?.description).toBe('Description EN second');
    });

    it('?lang=fr renvoie le français même si une version anglaise existe', async () => {
      const projects = ProjectsSchema.parse((await get('/api/v1/projects?lang=fr')).json());

      expect(projects[1]?.title).toBe('Titre FR second');
    });

    it('exclut un projet non publié et les compétences non publiées', async () => {
      await sql`update skills set published = false where slug = 'nodejs'`;
      try {
        const projects = ProjectsSchema.parse((await get('/api/v1/projects')).json());
        expect(projects.map((project) => project.slug)).not.toContain('cache');
        expect(projects[0]?.skills.map((skill) => skill.slug)).toEqual(['typescript']);
      } finally {
        await sql`update skills set published = true where slug = 'nodejs'`;
      }
    });
  });
});
