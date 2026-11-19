import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { expectProblem } from './support/problem.js';
import { startTestApp } from './support/test-app.js';

/** Collecte récursivement tous les `slug` d'une réponse JSON (listes, objets, éléments imbriqués). */
function slugsOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(slugsOf);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) =>
      key === 'slug' && typeof child === 'string' ? [child] : slugsOf(child),
    );
  }
  return [];
}

interface Case {
  path: string;
  table: string;
  slug: string;
}

/** Une entité par table, hors profil : seedée, ou insérée ci-dessous quand les seeds n'en ont pas. */
const CASES: readonly Case[] = [
  { path: '/api/v1/social-links', table: 'social_links', slug: 'linkedin' },
  { path: '/api/v1/skill-groups', table: 'skill_groups', slug: 'data-messaging' },
  { path: '/api/v1/skills', table: 'skills', slug: 'typescript' },
  { path: '/api/v1/experiences', table: 'experiences', slug: 'nopillo' },
  { path: '/api/v1/projects', table: 'projects', slug: 'qa-projet' },
  { path: '/api/v1/tools', table: 'tools', slug: 'qa-outil' },
  { path: '/api/v1/resources', table: 'resources', slug: 'qa-ressource' },
  { path: '/api/v1/certifications', table: 'certifications', slug: 'ef-set-plus-62' },
  { path: '/api/v1/education', table: 'education', slug: 'eemi' },
  { path: '/api/v1/languages', table: 'languages', slug: 'french' },
];

/**
 * Soft delete (DEC-4, docs/01) : `deleted_at` est distinct de `published`. Une ligne marquée n'est
 * servie par aucune route ni par `/cv` ; ses traductions et ses liaisons, conservées en base,
 * suivent leur entité.
 */
describe('soft delete : une entité marquée n’est servie nulle part', () => {
  let app: NestFastifyApplication;
  let sql: Sql;

  const json = async (url: string): Promise<unknown> =>
    (await app.inject({ method: 'GET', url })).json();

  beforeAll(async () => {
    await resetTestDatabase();
    sql = openTestSql();
    app = await startTestApp();
    await sql`insert into projects (slug) values ('qa-projet')`;
    await sql`
      insert into projects_translations (project_id, locale, title, description)
      select id, 'fr', 'Projet', 'Description' from projects`;
    await sql`
      insert into project_skills (project_id, skill_id)
      select p.id, s.id from projects p, skills s where s.slug = 'nodejs'`;
    await sql`insert into tools (slug) values ('qa-outil')`;
    await sql`
      insert into tools_translations (tool_id, locale, name, family, description)
      select id, 'fr', 'Outil', 'Famille', 'Description' from tools`;
    await sql`
      insert into resources (slug, url, group_id)
      values ('qa-ressource', 'https://example.org/r',
        (select id from skill_groups where slug = 'data-messaging'))`;
    await sql`
      insert into resources_translations (resource_id, locale, name, description)
      select id, 'fr', 'Ressource', 'Description' from resources`;
  });

  afterAll(async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    await resetTestDatabase();
  });

  it.each(CASES)(
    '$table/$slug : servie avant, absente de sa route et de /cv après (fr et en)',
    async ({ path, table, slug }) => {
      expect(slugsOf(await json(path))).toContain(slug);
      expect(slugsOf(await json('/api/v1/cv'))).toContain(slug);

      const marked = await sql`update ${sql(table)} set deleted_at = now() where slug = ${slug}`;

      expect(marked.count).toBe(1);
      for (const lang of ['fr', 'en']) {
        expect(slugsOf(await json(`${path}?lang=${lang}`))).not.toContain(slug);
        expect(slugsOf(await json(`/api/v1/cv?lang=${lang}`))).not.toContain(slug);
      }
    },
  );

  it('garde en base la ligne marquée, ses traductions et ses liaisons (suppression logique)', async () => {
    const rows = await sql<{ translations: number; links: number }[]>`
      select
        (select count(*)::int from projects_translations t where t.project_id = p.id) as translations,
        (select count(*)::int from project_skills l where l.project_id = p.id) as links
      from projects p where p.slug = 'qa-projet' and p.deleted_at is not null`;

    expect(rows).toEqual([{ translations: 1, links: 1 }]);
  });

  it('une compétence marquée disparaît des groupes imbriqués, pas les autres', async () => {
    const groups = slugsOf(await json('/api/v1/skill-groups'));

    expect(groups).not.toContain('typescript');
    expect(groups).toContain('nodejs');
  });

  it('un groupe marqué disparaît avec ses compétences', async () => {
    const skills = slugsOf(await json('/api/v1/skills'));

    expect(skills).not.toContain('postgresql');
    expect(skills).toContain('nodejs');
  });

  it('un groupe marqué n’est plus le groupe d’une ressource (groupSlug null)', async () => {
    // « qa-ressource » est elle-même marquée par le premier cas : on la remet en service.
    await sql`update resources set deleted_at = null where slug = 'qa-ressource'`;

    const resources = (await json('/api/v1/resources')) as { slug: string; groupSlug: unknown }[];

    expect(resources.find((resource) => resource.slug === 'qa-ressource')?.groupSlug).toBeNull();
  });
});

describe('soft delete d’une compétence liée', () => {
  let app: NestFastifyApplication;
  let sql: Sql;

  beforeAll(async () => {
    await resetTestDatabase();
    sql = openTestSql();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    await resetTestDatabase();
  });

  it('disparaît des expériences qui la listent, sans toucher aux autres compétences', async () => {
    const stack = async () =>
      slugsOf((await app.inject({ method: 'GET', url: '/api/v1/experiences' })).json());
    expect(await stack()).toContain('typescript');

    await sql`update skills set deleted_at = now() where slug = 'typescript'`;

    const after = await stack();
    expect(after).not.toContain('typescript');
    expect(after).toContain('docker');
  });
});

describe('soft delete du profil', () => {
  let app: NestFastifyApplication;
  let sql: Sql;

  beforeAll(async () => {
    await resetTestDatabase();
    sql = openTestSql();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    await resetTestDatabase();
  });

  it('un profil marqué n’est plus servi : 404 sur /profile et sur /cv (pas de CV partiel)', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/profile' })).statusCode).toBe(200);

    await sql`update profile set deleted_at = now() where id = 1`;

    expectProblem(await app.inject({ method: 'GET', url: '/api/v1/profile' }), 404);
    expectProblem(await app.inject({ method: 'GET', url: '/api/v1/cv' }), 404);
  });
});
