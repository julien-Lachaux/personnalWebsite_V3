import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { CvSchema, ExperienceSchema } from '@siteperso/contracts';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { runSeeds } from '../../src/infrastructure/db/seeds-runner.js';
import {
  migrationsDirectory,
  openTestSql,
  resetTestDatabase,
  seedsDirectory,
  testDatabaseUrl,
} from '../support/database.js';
import { startTestApp } from '../support/test-app.js';
import { validate } from '../support/validate.js';

const ExperiencesSchema = z.array(ExperienceSchema);

/** BF-12 (brief back-004) : l'expérience OpenClassrooms n'a pas de lieu (location nul, fr et en). */
describe('lieu nul de l’expérience OpenClassrooms (BF-12)', () => {
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

  it.each(['fr', 'en'] as const)(
    'GET /experiences sert openclassrooms-mentor avec location null (lang=%s)',
    async (lang) => {
      const response = await app.inject({ method: 'GET', url: `/api/v1/experiences?lang=${lang}` });
      expect(response.statusCode).toBe(200);
      const experiences = validate(ExperiencesSchema, response.json());

      const mentor = experiences.find((experience) => experience.slug === 'openclassrooms-mentor');
      expect(mentor?.location).toBeNull();
      expect(mentor?.company).toBe('OpenClassrooms');
      // Seule l'expérience OpenClassrooms perd son lieu : la pause est l'autre lieu nul.
      const withoutLocation = experiences.filter((experience) => experience.location === null);
      expect(withoutLocation.map((experience) => experience.slug).sort()).toEqual([
        'openclassrooms-mentor',
        'pause-professionnelle',
      ]);
    },
  );

  it.each(['fr', 'en'] as const)(
    'GET /cv sert openclassrooms-mentor avec location null (lang=%s)',
    async (lang) => {
      const response = await app.inject({ method: 'GET', url: `/api/v1/cv?lang=${lang}` });
      expect(response.statusCode).toBe(200);
      const cv = validate(CvSchema, response.json());

      const mentor = cv.experiences.find(
        (experience) => experience.slug === 'openclassrooms-mentor',
      );
      expect(mentor?.location).toBeNull();
    },
  );

  it('stocke un lieu nul dans les deux traductions et rejoue le seed deux fois sans écart', async () => {
    const read = () => sql<{ locale: string; location: string | null }[]>`
      select t.locale, t.location from experiences_translations t
      join experiences e on e.id = t.experience_id
      where e.slug = 'openclassrooms-mentor' order by t.locale`;
    const expected = [
      { locale: 'en', location: null },
      { locale: 'fr', location: null },
    ];
    expect(await read()).toEqual(expected);

    const fingerprint = () => sql<{ hash: string }[]>`
      select md5(string_agg(t::text, '|' order by t.experience_id, t.locale)) as hash
      from experiences_translations t`;
    const before = await fingerprint();

    for (let pass = 0; pass < 2; pass += 1) {
      await runSeeds({
        databaseUrl: testDatabaseUrl(),
        directory: seedsDirectory,
        migrationsDirectory,
        log: () => undefined,
      });
    }

    expect(await read()).toEqual(expected);
    expect(await fingerprint()).toEqual(before);
  });
});
