import { type Locale } from '@siteperso/contracts';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { type SocialLinksRepository } from '../../../application/social-links/ports/social-links-repository.port.js';
import { type SocialLink } from '../../../domain/social-links/social-link.js';
import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { socialLinks, socialLinksTranslations } from '../schema/index.js';
import { translated, translationAliases } from '../translated.js';

/** Implémentation Drizzle du dépôt de liens sociaux : une seule requête. */
export class DrizzleSocialLinksRepository implements SocialLinksRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  findAllPublished(locale: Locale): Promise<SocialLink[]> {
    const { fr, en } = translationAliases(socialLinksTranslations);

    return this.client.db
      .select({
        slug: socialLinks.slug,
        kind: socialLinks.kind,
        url: socialLinks.url,
        label: translated(en, fr, 'label'),
      })
      .from(socialLinks)
      .innerJoin(fr, and(eq(fr.socialLinkId, socialLinks.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.socialLinkId, socialLinks.id), eq(en.locale, locale)))
      .where(and(eq(socialLinks.published, true), isNull(socialLinks.deletedAt)))
      .orderBy(asc(socialLinks.sortOrder), asc(socialLinks.id));
  }
}
