import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { LanguageSchema, PROBLEM_JSON_CONTENT_TYPE } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const LanguagesSchema = z.array(LanguageSchema);

async function get(app: NestFastifyApplication, lang?: string) {
  const url = lang === undefined ? '/api/v1/languages' : `/api/v1/languages?lang=${lang}`;
  return app.inject({ method: 'GET', url });
}

describe('GET /api/v1/languages', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  it('répond 200 avec 2 langues validées par le contrat strict', async () => {
    const response = await get(app);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(LanguagesSchema.parse(response.json())).toHaveLength(2);
  });

  it('cefrLevel vaut C1 pour l’anglais et null pour le français', async () => {
    const languages = LanguagesSchema.parse((await get(app)).json());

    expect(languages.find((language) => language.code === 'en')?.cefrLevel).toBe('C1');
    expect(languages.find((language) => language.code === 'fr')?.cefrLevel).toBeNull();
    expect(languages.map((language) => language.code)).toEqual(['fr', 'en']);
  });

  it('?lang=en renvoie les libellés en anglais', async () => {
    const fr = LanguagesSchema.parse((await get(app, 'fr')).json());
    const en = LanguagesSchema.parse((await get(app, 'en')).json());

    expect(en.map((language) => language.slug)).toEqual(fr.map((language) => language.slug));
    expect(en[0]?.name).not.toBe(fr[0]?.name);
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
        await sql`
          delete from languages_translations
          where locale = 'en' and language_id = (select id from languages where code = 'en')`;
        await sql`update languages set published = false where code = 'fr'`;
      } finally {
        await sql.end();
      }
    });

    it('exclut la langue non publiée', async () => {
      const languages = LanguagesSchema.parse((await get(app)).json());

      expect(languages.map((language) => language.slug)).toEqual(['english']);
    });

    it('?lang=en se replie sur le français quand la ligne en manque', async () => {
      const fr = LanguagesSchema.parse((await get(app, 'fr')).json());
      const en = LanguagesSchema.parse((await get(app, 'en')).json());

      expect(en).toEqual(fr);
      expect(en[0]?.name).toBe('Anglais');
    });
  });
});
