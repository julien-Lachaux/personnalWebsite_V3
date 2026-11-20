import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { CvSchema, type Profile, ProfileSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { expectProblem } from './support/problem.js';
import { startTestApp } from './support/test-app.js';
import { validate } from './support/validate.js';

/** Profil restructuré pour le design v6 (BF-1, brief back-001) : contrat, repli par ligne, absence. */
describe('GET /api/v1/profile : champs du design v6 (BF-1)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  const get = (url: string) => app.inject({ method: 'GET', url });

  async function profile(lang: 'fr' | 'en'): Promise<Profile> {
    const response = await get(`/api/v1/profile?lang=${lang}`);
    expect(response.statusCode).toBe(200);
    return validate(ProfileSchema, response.json());
  }

  /** Exécute une requête SQL de modification sur la base de test. */
  async function alter(statement: (sql: ReturnType<typeof openTestSql>) => Promise<unknown>) {
    const sql = openTestSql();
    try {
      await statement(sql);
    } finally {
      await sql.end();
    }
  }

  describe('base seedée', () => {
    it('sert en français les textes du handoff, sans headline, bio ni availability', async () => {
      const fr = await profile('fr');

      expect(fr).toMatchObject({
        title: 'Développeur full-stack',
        titleBadge: 'senior',
        taglines: [
          'NestJS, Vue.js — données, ETL et analytics',
          'Développement assisté par IA et agentique',
        ],
        seekingAvailability: 'Immédiate',
        cvPath: '/cv/cv-fr.pdf',
      });
      expect(fr.intro).toMatch(/^Depuis 2017/);
      expect(fr.mission).toMatch(/^Je souhaite/);
      expect(fr.currentActivity).toMatch(/^Bénévole/);
      expect(fr.seekingFormat).toMatch(/^Temps partiel/);
      expect(fr.seekingLocation).toMatch(/^Paris/);
      for (const key of ['headline', 'bio', 'availability']) {
        expect(fr).not.toHaveProperty(key);
      }
    });

    it('sert en anglais la ligne en entière, avec son propre CV', async () => {
      const fr = await profile('fr');
      const en = await profile('en');

      expect(en.cvPath).toBe('/cv/cv-en.pdf');
      expect(en.seekingAvailability).toBe('Immediate');
      expect(en.taglines).toHaveLength(2);
      expect(en.taglines).not.toEqual(fr.taglines);
      for (const key of ['intro', 'mission', 'currentActivity', 'seekingFormat'] as const) {
        expect(en[key], key).not.toBe(fr[key]);
      }
    });

    it.each(['fr', 'en'] as const)(
      'cv.profile est strictement égal à /profile (lang=%s)',
      async (lang) => {
        const cv = validate(CvSchema, (await get(`/api/v1/cv?lang=${lang}`)).json());

        expect(cv.profile).toStrictEqual(await profile(lang));
      },
    );
  });

  describe('lignes de traduction : la base refuse toute valeur vide ou nulle', () => {
    beforeEach(async () => {
      await resetTestDatabase();
    });

    const COLUMNS = [
      'title_badge',
      'intro',
      'mission',
      'current_activity',
      'seeking_format',
      'seeking_location',
      'seeking_availability',
      'cv_path',
    ];

    it.each(
      ['fr', 'en'].flatMap((locale) =>
        [...COLUMNS, 'taglines'].map((column) => [locale, column] as const),
      ),
    )('ligne %s : %s nulle refusée, profil inchangé', async (locale, column) => {
      const before = await profile('fr');

      await expect(
        alter((sql) =>
          sql.unsafe(`update profile_translations set ${column} = null where locale = '${locale}'`),
        ),
      ).rejects.toThrow(new RegExp(`null value in column "${column}"`));

      expect(await profile('fr')).toStrictEqual(before);
    });

    it.each(['fr', 'en'].flatMap((locale) => COLUMNS.map((column) => [locale, column] as const)))(
      'ligne %s : %s vide refusée',
      async (locale, column) => {
        await expect(
          alter((sql) =>
            sql.unsafe(`update profile_translations set ${column} = '' where locale = '${locale}'`),
          ),
        ).rejects.toThrow(new RegExp(`profile_translations_${column}_check`));
      },
    );

    it.each([
      ['des accroches vides', "'{}'"],
      ['une accroche vide', "array['Accroche', '']"],
      ['une accroche nulle', "array['Accroche', null]"],
    ])('taglines avec %s refusées', async (_label, value) => {
      await expect(
        alter((sql) => sql.unsafe(`update profile_translations set taglines = ${value}`)),
      ).rejects.toThrow(/profile_translations_taglines_check/);
    });

    it('sans ligne en, la ligne fr est servie entière en anglais', async () => {
      const fr = await profile('fr');
      await alter((sql) => sql`delete from profile_translations where locale = 'en'`);

      const en = await profile('en');

      expect(en).toStrictEqual(fr);
      expect(en.cvPath).toBe('/cv/cv-fr.pdf');
      const cv = validate(CvSchema, (await get('/api/v1/cv?lang=en')).json());
      expect(cv.profile).toStrictEqual(fr);
    });
  });

  describe('ligne fr absente ou profil marqué supprimé : aucun profil servi (404)', () => {
    beforeEach(async () => {
      await resetTestDatabase();
    });

    it('sans ligne fr : 404 problem+json en fr comme en en, et pour /cv', async () => {
      await alter((sql) => sql`delete from profile_translations where locale = 'fr'`);

      for (const lang of ['fr', 'en']) {
        const problem = expectProblem(await get(`/api/v1/profile?lang=${lang}`), 404);
        expect(problem.detail).toBe('Profil « profile » introuvable.');
        expectProblem(await get(`/api/v1/cv?lang=${lang}`), 404);
      }
    });

    it('profil marqué deleted_at : 404 problem+json pour /profile et /cv', async () => {
      await alter((sql) => sql`update profile set deleted_at = now()`);

      for (const lang of ['fr', 'en']) {
        expectProblem(await get(`/api/v1/profile?lang=${lang}`), 404);
        expectProblem(await get(`/api/v1/cv?lang=${lang}`), 404);
      }
    });
  });
});
