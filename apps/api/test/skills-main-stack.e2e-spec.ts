import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  CvSchema,
  ExperienceSchema,
  ProjectSchema,
  type Skill,
  SkillGroupSchema,
  SkillSchema,
} from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { withFixture } from './support/fixtures.js';
import { startTestApp } from './support/test-app.js';
import { validate } from './support/validate.js';

/** Stack principale seedée (BF-3, brief back-001), par rang croissant. */
const MAIN_STACK = ['typescript', 'nodejs', 'nestjs', 'vuejs', 'postgresql', 'kafka', 'docker'];

/** `rang:slug` des compétences de la stack principale, triées par rang. */
function mainStack(skills: readonly Pick<Skill, 'slug' | 'mainStackOrder'>[]): string[] {
  return skills
    .filter((skill) => skill.mainStackOrder !== null)
    .sort((a, b) => (a.mainStackOrder ?? 0) - (b.mainStackOrder ?? 0))
    .map((skill) => `${skill.mainStackOrder}:${skill.slug}`);
}

const EXPECTED = MAIN_STACK.map((slug, index) => `${index + 1}:${slug}`);

describe('mainStackOrder des compétences (BF-3)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  async function json<S extends z.ZodType>(schema: S, url: string): Promise<z.output<S>> {
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode, url).toBe(200);
    return validate(schema, response.json());
  }

  describe.each(['fr', 'en'] as const)('lang=%s', (lang) => {
    it('/skills : les sept rangs du brief, null pour toutes les autres', async () => {
      const skills = await json(z.array(SkillSchema), `/api/v1/skills?lang=${lang}`);

      expect(mainStack(skills)).toEqual(EXPECTED);
      expect(skills.filter((skill) => skill.mainStackOrder === null)).toHaveLength(
        skills.length - MAIN_STACK.length,
      );
    });

    it('/skill-groups et /cv portent les mêmes rangs', async () => {
      const groups = await json(z.array(SkillGroupSchema), `/api/v1/skill-groups?lang=${lang}`);
      const cv = await json(CvSchema, `/api/v1/cv?lang=${lang}`);

      expect(mainStack(groups.flatMap((group) => group.skills))).toEqual(EXPECTED);
      expect(cv.skillGroups).toStrictEqual(groups);
    });

    it('/experiences : une compétence liée garde son rang', async () => {
      const experiences = await json(z.array(ExperienceSchema), `/api/v1/experiences?lang=${lang}`);
      const contentsquare = experiences.find((experience) => experience.slug === 'contentsquare');

      expect(mainStack(contentsquare?.skills ?? [])).toEqual(
        EXPECTED.filter((e) => e !== '2:nodejs'),
      );
      expect(contentsquare?.skills.find((s) => s.slug === 'redis')?.mainStackOrder).toBeNull();
    });
  });

  it('/projects : une compétence liée à un projet porte aussi son rang', async () => {
    await withFixture(
      async (sql) => {
        await sql`insert into projects (slug, year, sort_order) values ('qa-projet-stack', 2026, 1)`;
        await sql`
          insert into projects_translations (project_id, locale, title, description)
          select id, 'fr', 'Projet', 'Description' from projects where slug = 'qa-projet-stack'`;
        await sql`
          insert into project_skills (project_id, skill_id, sort_order)
          select p.id, s.id, v.sort_order
          from projects p, skills s, (values ('typescript', 1), ('php', 2)) as v (slug, sort_order)
          where p.slug = 'qa-projet-stack' and s.slug = v.slug`;
      },
      async () => {
        const [project] = await json(z.array(ProjectSchema), '/api/v1/projects');

        expect(project?.skills.map((skill) => [skill.slug, skill.mainStackOrder])).toEqual([
          ['typescript', 1],
          ['php', null],
        ]);
      },
    );
  });

  it('suit la colonne skills.main_stack_order', async () => {
    const sql = openTestSql();
    try {
      await sql`update skills set main_stack_order = null where slug = 'docker'`;
      await sql`update skills set main_stack_order = 7 where slug = 'php'`;
    } finally {
      await sql.end();
    }

    const skills = await json(z.array(SkillSchema), '/api/v1/skills');

    expect(mainStack(skills)).toEqual([...EXPECTED.slice(0, 6), '7:php']);
    expect(skills.find((skill) => skill.slug === 'docker')?.mainStackOrder).toBeNull();
  });
});
