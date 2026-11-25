import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { CvSchema, SocialLinkSchema } from '@siteperso/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { resetTestDatabase } from './support/database.js';
import { startTestApp } from './support/test-app.js';
import { validate } from './support/validate.js';

/**
 * BF-6 (brief back-001) : le lien vers les recommandations LinkedIn est une ligne de `social_links`.
 * Le contrat `SocialLink` le décrit déjà (slug, kind ouvert, URL http(s), libellé traduit) : aucun
 * changement de contrat, l'API le sert comme les autres liens.
 */
describe('lien des recommandations LinkedIn servi par l’API (BF-6)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const LABELS = {
    fr: 'Recommandations publiées sur LinkedIn',
    en: 'Recommendations published on LinkedIn',
  } as const;

  it.each(['fr', 'en'] as const)(
    '/social-links : lien linkedin-recommendations après linkedin, libellé traduit (lang=%s)',
    async (lang) => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/social-links?lang=${lang}`,
      });
      const links = validate(z.array(SocialLinkSchema), response.json());

      expect(links.map((link) => link.slug)).toEqual(['linkedin', 'linkedin-recommendations']);
      expect(links[1]).toStrictEqual({
        slug: 'linkedin-recommendations',
        kind: 'linkedin',
        url: 'https://www.linkedin.com/in/julien-lachaux/details/recommendations/',
        label: LABELS[lang],
      });
    },
  );

  it.each(['fr', 'en'] as const)('/cv : mêmes liens que /social-links (lang=%s)', async (lang) => {
    const cv = validate(
      CvSchema,
      (await app.inject({ method: 'GET', url: `/api/v1/cv?lang=${lang}` })).json(),
    );
    const links = (
      await app.inject({ method: 'GET', url: `/api/v1/social-links?lang=${lang}` })
    ).json<unknown>();

    expect(cv.socialLinks).toStrictEqual(links);
  });
});
