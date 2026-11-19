import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { CvSchema, EducationSchema, ExperienceSchema } from '@siteperso/contracts';
import { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const ExperiencesSchema = z.array(ExperienceSchema);
const EducationListSchema = EducationSchema.array();

/**
 * Repli de langue par ligne (DEC-1, docs/01) : si la traduction `en` d'une entité existe, elle est
 * servie entière (aucun champ complété par le français) ; sinon la ligne `fr` est servie entière.
 */
describe('repli de langue par ligne', () => {
  let app: NestFastifyApplication;
  let sql: Sql;

  const getJson = async (url: string): Promise<unknown> =>
    (await app.inject({ method: 'GET', url })).json();
  const experiences = async (lang: string) =>
    ExperiencesSchema.parse(await getJson(`/api/v1/experiences?lang=${lang}`));
  const education = async (lang: string) =>
    EducationListSchema.parse(await getJson(`/api/v1/education?lang=${lang}`));

  beforeAll(async () => {
    await resetTestDatabase();
    sql = openTestSql();
    app = await startTestApp();
    // Contentsquare : ligne `en` volontairement lacunaire (champs nuls, tableau vide) alors que le
    // français est complet. Wynd (ETL) : plus de ligne `en`. Une formation : description `en` nulle.
    await sql`
      update experiences_translations
      set location = null, stack_label = null, achievements = '{}', logo_alt = null
      where locale = 'en'
        and experience_id = (select id from experiences where slug = 'contentsquare')`;
    await sql`
      delete from experiences_translations
      where locale = 'en'
        and experience_id = (select id from experiences where slug = 'wynd-etl')`;
    await sql`
      update education_translations set description = null
      where locale = 'en'
        and education_id = (select id from education order by sort_order, id limit 1)`;
  });

  afterAll(async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    await resetTestDatabase();
  });

  it('sert la ligne en entière : aucun champ nul de la ligne en n’est complété par le français', async () => {
    const fr = (await experiences('fr')).find((item) => item.slug === 'contentsquare');
    const en = (await experiences('en')).find((item) => item.slug === 'contentsquare');

    expect(fr?.achievements.length).toBeGreaterThan(0);
    expect(fr?.logo).not.toBeNull();
    expect(en).toMatchObject({ location: null, stackLabel: null, achievements: [], logo: null });
    expect(en?.summary).not.toBe(fr?.summary);
  });

  it('sert la ligne fr entière quand la traduction en de l’entité n’existe pas', async () => {
    const fr = (await experiences('fr')).find((item) => item.slug === 'wynd-etl');
    const en = (await experiences('en')).find((item) => item.slug === 'wynd-etl');

    expect(en).toBeDefined();
    const { skills: enSkills, ...enRest } = en!;
    const { skills: frSkills, ...frRest } = fr!;
    expect(enRest).toEqual(frRest);
    expect(enRest.achievements.length).toBeGreaterThan(0);
    expect(enSkills.map((skill) => skill.slug)).toEqual(frSkills.map((skill) => skill.slug));
  });

  it('applique la même règle aux autres ressources (formations)', async () => {
    const fr = await education('fr');
    const en = await education('en');

    expect(fr[0]?.description).not.toBeNull();
    expect(en[0]).toMatchObject({ slug: fr[0]?.slug, description: null });
    expect(en[0]?.title).not.toBe(fr[0]?.title);
    expect(en[2]).toEqual(expect.objectContaining({ description: expect.any(String) as string }));
  });

  it('GET /cv suit la même règle que les ressources', async () => {
    const cv = CvSchema.parse(await getJson('/api/v1/cv?lang=en'));
    const contentsquare = cv.experiences.find((item) => item.slug === 'contentsquare');

    expect(contentsquare).toMatchObject({ location: null, achievements: [], logo: null });
  });
});
