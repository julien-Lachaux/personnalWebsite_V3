import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ExperienceSchema, PROBLEM_JSON_CONTENT_TYPE } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const ExperiencesSchema = z.array(ExperienceSchema);

async function get(app: NestFastifyApplication, lang?: string) {
  const url = lang === undefined ? '/api/v1/experiences' : `/api/v1/experiences?lang=${lang}`;
  return app.inject({ method: 'GET', url });
}

describe('GET /api/v1/experiences', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  it('répond 200 avec 8 expériences validées par le contrat strict', async () => {
    const response = await get(app);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(ExperiencesSchema.parse(response.json())).toHaveLength(8);
  });

  it('trie par date de début décroissante, la plus récente en premier', async () => {
    const experiences = ExperiencesSchema.parse((await get(app)).json());
    const dates = experiences.map((experience) => experience.dateStart);

    expect(experiences[0]?.slug).toBe('nopillo');
    expect(dates).toEqual([...dates].sort().reverse());
    expect(dates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))).toBe(true);
  });

  it('la pause (kind break) n’a pas de société et porte « Huile de coude »', async () => {
    const experiences = ExperiencesSchema.parse((await get(app)).json());
    const pause = experiences.find((experience) => experience.kind === 'break');

    expect(pause).toMatchObject({
      company: null,
      companyUrl: null,
      logo: null,
      contractType: null,
      workMode: null,
      stackLabel: 'Huile de coude',
      achievements: [],
      skills: [],
    });
  });

  it('renvoie le logo en { path, alt }, les enums et les réalisations en tableau', async () => {
    const experiences = ExperiencesSchema.parse((await get(app)).json());
    const nopillo = experiences.find((experience) => experience.slug === 'nopillo');

    expect(nopillo?.logo).toEqual({
      path: '/images/logos/nopillo.svg',
      alt: expect.stringMatching(/\S/) as string,
    });
    expect(nopillo?.contractType).toBe('cdi');
    expect(nopillo?.workMode).toBe('hybrid');
    expect(nopillo?.achievements.length).toBeGreaterThan(0);
  });

  it('imbrique les compétences dans l’ordre de experience_skills.sort_order', async () => {
    const experiences = ExperiencesSchema.parse((await get(app)).json());
    const nopillo = experiences.find((experience) => experience.slug === 'nopillo');

    expect(nopillo?.skills.map((skill) => skill.slug)).toEqual([
      'typescript',
      'elysia',
      'solidjs',
      'mastra',
      'posthog',
      'docker',
    ]);
  });

  it('?lang=en renvoie les réalisations en anglais', async () => {
    const fr = ExperiencesSchema.parse((await get(app, 'fr')).json());
    const en = ExperiencesSchema.parse((await get(app, 'en')).json());
    const frNopillo = fr.find((experience) => experience.slug === 'nopillo');
    const enNopillo = en.find((experience) => experience.slug === 'nopillo');

    expect(enNopillo?.achievements.length).toBe(frNopillo?.achievements.length);
    expect(enNopillo?.achievements).not.toEqual(frNopillo?.achievements);
    expect(enNopillo?.summary).not.toBe(frNopillo?.summary);
    expect(en.find((experience) => experience.kind === 'break')?.stackLabel).toBe('Elbow grease');
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
        // Contentsquare perd sa traduction anglaise : repli complet sur le français.
        await sql`
          delete from experiences_translations
          where locale = 'en'
            and experience_id = (select id from experiences where slug = 'contentsquare')`;
        // Une expérience non publiée disparaît, une compétence non publiée aussi de sa stack.
        await sql`update experiences set published = false where slug = 'leboncoin'`;
        await sql`update skills set published = false where slug = 'docker'`;
        // Une expérience en cours, sans logo, plus récente que toutes les autres.
        await sql`
          insert into experiences (slug, kind, company, contract_type, work_mode, date_start, date_end, sort_order)
          values ('test-en-cours', 'freelance', 'Société test', 'freelance', 'remote', '2026-06-01', null, 0)`;
        await sql`
          insert into experiences_translations (experience_id, locale, job_title, summary, achievements)
          select id, 'fr', 'Poste test', 'Résumé test', '{"A","B"}' from experiences where slug = 'test-en-cours'`;
      } finally {
        await sql.end();
      }
    });

    it('exclut l’expérience non publiée et la compétence non publiée', async () => {
      const experiences = ExperiencesSchema.parse((await get(app)).json());
      const slugs = experiences.map((experience) => experience.slug);

      expect(slugs).not.toContain('leboncoin');
      const skillSlugs = experiences.flatMap((experience) =>
        experience.skills.map((skill) => skill.slug),
      );
      expect(skillSlugs).not.toContain('docker');
      expect(
        experiences.find((experience) => experience.slug === 'nopillo')?.skills.map((s) => s.slug),
      ).toEqual(['typescript', 'elysia', 'solidjs', 'mastra', 'posthog']);
    });

    it('place en tête l’expérience en cours (dateEnd null, logo null)', async () => {
      const experiences = ExperiencesSchema.parse((await get(app)).json());

      expect(experiences[0]).toMatchObject({
        slug: 'test-en-cours',
        dateEnd: null,
        logo: null,
        achievements: ['A', 'B'],
        skills: [],
        location: null,
        stackLabel: null,
      });
    });

    it('?lang=en se replie sur le français pour une expérience sans traduction en', async () => {
      const fr = ExperiencesSchema.parse((await get(app, 'fr')).json());
      const en = ExperiencesSchema.parse((await get(app, 'en')).json());
      const find = (list: typeof fr) =>
        list.find((experience) => experience.slug === 'contentsquare');

      // Les compétences gardent leur propre traduction en : on compare le reste de l'expérience.
      const enExperience = find(en);
      const frExperience = find(fr);
      expect(enExperience).toBeDefined();
      expect(frExperience).toBeDefined();
      const { skills: enSkills, ...enRest } = enExperience!;
      const { skills: frSkills, ...frRest } = frExperience!;
      expect(enRest).toEqual(frRest);
      expect(enRest.achievements.length).toBeGreaterThan(0);
      expect(enSkills.map((skill) => skill.slug)).toEqual(frSkills.map((skill) => skill.slug));
    });
  });
});
