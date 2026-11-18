import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { CvSchema, ExperienceSchema, PROBLEM_JSON_CONTENT_TYPE } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const ExperiencesSchema = z.array(ExperienceSchema);

/** Seuil indicatif du critère L3-13 (base seedée, en local) ; assertion volontairement souple. */
const RESPONSE_TIME_BUDGET_MS = 200;
/** Marge pour les machines lentes ou chargées (CI, `pnpm check` en parallèle) : seul un ordre de grandeur est vérifié. */
const RESPONSE_TIME_TOLERANCE = 5;

async function get(app: NestFastifyApplication, path: string, lang?: string) {
  const url = lang === undefined ? `/api/v1/${path}` : `/api/v1/${path}?lang=${lang}`;
  return app.inject({ method: 'GET', url });
}

describe('GET /api/v1/cv', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  it('répond 200 avec un CV validé par le contrat strict, en français par défaut', async () => {
    const response = await get(app, 'cv');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const cv = CvSchema.parse(response.json());
    expect(cv.locale).toBe('fr');
    expect(cv.skillGroups).toHaveLength(7);
    expect(cv.experiences).toHaveLength(8);
    expect(cv.languages).toHaveLength(2);
  });

  it('?lang=en renvoie locale en et un contenu traduit', async () => {
    const fr = CvSchema.parse((await get(app, 'cv', 'fr')).json());
    const en = CvSchema.parse((await get(app, 'cv', 'en')).json());

    expect(en.locale).toBe('en');
    expect(en.profile.title).not.toBe(fr.profile.title);
  });

  it.each(['fr', 'en'])(
    'cv.experiences est strictement égal à la réponse de /experiences (lang=%s)',
    async (lang) => {
      const cv = CvSchema.parse((await get(app, 'cv', lang)).json());
      const experiences = ExperiencesSchema.parse((await get(app, 'experiences', lang)).json());

      expect(cv.experiences).toStrictEqual(experiences);
    },
  );

  it('?lang=de répond 400 problem+json', async () => {
    const response = await get(app, 'cv', 'de');

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
  });

  it('répond en moins de 200 ms sur la base seedée (seuil indicatif)', async () => {
    await get(app, 'cv'); // échauffement : première requête, connexions ouvertes

    const start = performance.now();
    const response = await get(app, 'cv');
    const elapsed = performance.now() - start;

    expect(response.statusCode).toBe(200);
    // Souple : le critère du backlog est 200 ms en local ; on échoue seulement au-delà de 5 fois.
    expect(elapsed).toBeLessThan(RESPONSE_TIME_BUDGET_MS * RESPONSE_TIME_TOLERANCE);
  });
});
