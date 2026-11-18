import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PROBLEM_JSON_CONTENT_TYPE, SkillGroupSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const SkillGroupsSchema = z.array(SkillGroupSchema);

async function get(app: NestFastifyApplication, lang?: string) {
  const url = lang === undefined ? '/api/v1/skill-groups' : `/api/v1/skill-groups?lang=${lang}`;
  return app.inject({ method: 'GET', url });
}

describe('GET /api/v1/skill-groups', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  it('répond 200 avec 7 groupes validés par le contrat strict', async () => {
    const response = await get(app);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const groups = SkillGroupsSchema.parse(response.json());
    expect(groups).toHaveLength(7);
    expect(groups[0]?.slug).toBe('languages-frameworks');
    expect(groups.every((group) => group.skills.length > 0)).toBe(true);
  });

  it('imbrique les compétences dans le bon groupe, triées', async () => {
    const groups = SkillGroupsSchema.parse((await get(app)).json());
    const first = groups[0];

    expect(first?.skills.map((skill) => skill.slug).slice(0, 3)).toEqual([
      'typescript',
      'javascript',
      'nodejs',
    ]);
    for (const group of groups) {
      expect(group.skills.every((skill) => skill.groupSlug === group.slug)).toBe(true);
    }
  });

  it('?lang=en renvoie les noms de groupes en anglais', async () => {
    const groups = SkillGroupsSchema.parse((await get(app, 'en')).json());

    expect(groups[0]?.name).toBe('Languages and frameworks');
  });

  it('?lang=de répond 400 problem+json', async () => {
    const response = await get(app, 'de');

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
  });

  describe('avec des modifications de la base', () => {
    beforeAll(async () => {
      const sql = openTestSql();
      try {
        // Un groupe de test sans traduction en, avec une compétence sans traduction en.
        await sql`insert into skill_groups (slug, sort_order, published) values ('test-groupe', 100, true)`;
        await sql`
          insert into skill_groups_translations (skill_group_id, locale, name, description)
          select id, 'fr', 'Groupe de test', 'Description FR' from skill_groups where slug = 'test-groupe'`;
        await sql`
          insert into skills (slug, group_id, level, icon, sort_order, published)
          select 'test-competence', id, 4, 'test', 1, true from skill_groups where slug = 'test-groupe'`;
        await sql`
          insert into skills_translations (skill_id, locale, name)
          select id, 'fr', 'Compétence FR' from skills where slug = 'test-competence'`;
        // Un groupe non publié disparaît avec ses compétences.
        await sql`update skill_groups set published = false where slug = 'devops'`;
      } finally {
        await sql.end();
      }
    });

    it('un groupe non publié disparaît avec ses compétences', async () => {
      const groups = SkillGroupsSchema.parse((await get(app)).json());

      expect(groups).toHaveLength(7);
      expect(groups.map((group) => group.slug)).not.toContain('devops');
      const skillSlugs = groups.flatMap((group) => group.skills.map((skill) => skill.slug));
      expect(skillSlugs).not.toContain('docker');
    });

    it('?lang=en se replie sur le français pour un groupe et ses compétences sans en', async () => {
      const groups = SkillGroupsSchema.parse((await get(app, 'en')).json());
      const group = groups.find((candidate) => candidate.slug === 'test-groupe');

      expect(group?.name).toBe('Groupe de test');
      expect(group?.description).toBe('Description FR');
      expect(group?.skills.map((skill) => skill.name)).toEqual(['Compétence FR']);
    });

    it('description nulle en base devient une chaîne vide', async () => {
      const groups = SkillGroupsSchema.parse((await get(app)).json());

      expect(groups[0]?.description).toBe('');
    });

    it('le groupe republié réapparaît avec ses compétences', async () => {
      const sql = openTestSql();
      try {
        await sql`update skill_groups set published = true where slug = 'devops'`;
      } finally {
        await sql.end();
      }

      const groups = SkillGroupsSchema.parse((await get(app)).json());
      const devops = groups.find((group) => group.slug === 'devops');

      expect(groups).toHaveLength(8);
      expect(devops?.skills.length).toBeGreaterThan(0);
    });
  });
});
