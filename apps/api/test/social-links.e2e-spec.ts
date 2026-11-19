import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PROBLEM_JSON_CONTENT_TYPE, SocialLinkSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { openTestSql, resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';

const SocialLinksSchema = z.array(SocialLinkSchema);

async function get(app: NestFastifyApplication, lang?: string) {
  const url = lang === undefined ? '/api/v1/social-links' : `/api/v1/social-links?lang=${lang}`;
  return app.inject({ method: 'GET', url });
}

describe('GET /api/v1/social-links', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
    await resetTestDatabase();
  });

  it('répond 200 avec un tableau validé par le contrat strict', async () => {
    const response = await get(app);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const links = SocialLinksSchema.parse(response.json());
    expect(links.map((link) => link.slug)).toContain('linkedin');
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
          insert into social_links (slug, kind, url, sort_order, published) values
            ('test-premier', 'github', 'https://example.com/premier', -2, true),
            ('test-masque', 'website', 'https://example.com/masque', -1, false),
            ('test-sans-en', 'website', 'https://example.com/sans-en', 99, true)`;
        await sql`
          insert into social_links_translations (social_link_id, locale, label)
          select id, 'fr', 'Libellé FR ' || slug from social_links where slug like 'test-%'`;
        await sql`
          insert into social_links_translations (social_link_id, locale, label)
          select id, 'en', 'Label EN ' || slug from social_links
          where slug in ('test-premier', 'test-masque')`;
      } finally {
        await sql.end();
      }
    });

    it('trie par sort_order et exclut les liens non publiés', async () => {
      const links = SocialLinksSchema.parse((await get(app)).json());
      const slugs = links.map((link) => link.slug);

      expect(slugs).not.toContain('test-masque');
      expect(slugs).toEqual([
        'test-premier',
        'linkedin',
        'linkedin-recommendations',
        'test-sans-en',
      ]);
    });

    it('?lang=en traduit quand la ligne en existe, sinon se replie sur le français', async () => {
      const links = SocialLinksSchema.parse((await get(app, 'en')).json());
      const labelOf = (slug: string) => links.find((link) => link.slug === slug)?.label;

      expect(labelOf('test-premier')).toBe('Label EN test-premier');
      expect(labelOf('test-sans-en')).toBe('Libellé FR test-sans-en');
    });

    it('?lang=fr renvoie le français', async () => {
      const links = SocialLinksSchema.parse((await get(app, 'fr')).json());

      expect(links.find((link) => link.slug === 'test-premier')?.label).toBe(
        'Libellé FR test-premier',
      );
    });
  });
});
