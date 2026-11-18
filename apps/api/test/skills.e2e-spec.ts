import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PROBLEM_JSON_CONTENT_TYPE, SkillSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const SkillsSchema = z.array(SkillSchema);

async function get(app: NestFastifyApplication, lang?: string) {
  const url = lang === undefined ? '/api/v1/skills' : `/api/v1/skills?lang=${lang}`;
  return app.inject({ method: 'GET', url });
}

describe('GET /api/v1/skills', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  it('répond 200 avec au moins 30 compétences validées par le contrat strict', async () => {
    const response = await get(app);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const skills = SkillsSchema.parse(response.json());
    expect(skills.length).toBeGreaterThanOrEqual(30);
    expect(skills[0]?.groupSlug).toBe('languages-frameworks');
  });

  it('?lang=en garde le nom propre à l’identique', async () => {
    const skills = SkillsSchema.parse((await get(app, 'en')).json());

    expect(skills.find((skill) => skill.slug === 'typescript')?.name).toBe('TypeScript');
  });

  it('?lang=de répond 400 problem+json', async () => {
    const response = await get(app, 'de');

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
  });

  describe('avec des fixtures', () => {
    beforeAll(async () => {
      const sql = openTestSql();
      try {
        await sql`
          insert into skill_groups (slug, sort_order, published) values
            ('test-groupe-masque', 90, false)`;
        await sql`
          insert into skill_groups_translations (skill_group_id, locale, name)
          select id, 'fr', 'Groupe masqué' from skill_groups where slug = 'test-groupe-masque'`;
        await sql`
          insert into skills (slug, group_id, level, icon, sort_order, published)
          select v.slug, g.id, 2, 'test', v.sort_order, v.published
          from (values
            ('test-masquee', 'languages-frameworks', 500, false),
            ('test-sans-en', 'languages-frameworks', 501, true),
            ('test-groupe-non-publie', 'test-groupe-masque', 1, true)
          ) as v (slug, group_slug, sort_order, published)
          join skill_groups g on g.slug = v.group_slug`;
        await sql`
          insert into skills_translations (skill_id, locale, name)
          select id, 'fr', 'Nom FR ' || slug from skills where slug like 'test-%'`;
        await sql`
          insert into skills_translations (skill_id, locale, name)
          select id, 'en', 'Name EN ' || slug from skills
          where slug in ('test-masquee', 'test-groupe-non-publie')`;
      } finally {
        await sql.end();
      }
    });

    it('exclut la compétence non publiée et celles d’un groupe non publié', async () => {
      const slugs = SkillsSchema.parse((await get(app)).json()).map((skill) => skill.slug);

      expect(slugs).not.toContain('test-masquee');
      expect(slugs).not.toContain('test-groupe-non-publie');
      expect(slugs).toContain('test-sans-en');
    });

    it('trie par groupe puis sort_order', async () => {
      const skills = SkillsSchema.parse((await get(app)).json());
      const slugs = skills.map((skill) => skill.slug);

      // La compétence ajoutée (sort_order 501) vient après toutes celles de son groupe, avant
      // celles du groupe suivant.
      const index = slugs.indexOf('test-sans-en');
      expect(skills[index - 1]?.groupSlug).toBe('languages-frameworks');
      expect(skills[index + 1]?.groupSlug).toBe('data-messaging');
    });

    it('?lang=en se replie sur le français quand la ligne en manque', async () => {
      const skills = SkillsSchema.parse((await get(app, 'en')).json());

      expect(skills.find((skill) => skill.slug === 'test-sans-en')?.name).toBe(
        'Nom FR test-sans-en',
      );
    });
  });
});
