import { type Locale } from '@siteperso/contracts';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { type RecommendationsRepository } from '../../../application/recommendations/ports/recommendations-repository.port.js';
import { type Recommendation } from '../../../domain/recommendations/recommendation.js';
import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { recommendations, recommendationsTranslations } from '../schema/index.js';
import { translated, translationAliases } from '../translated.js';

/**
 * Implémentation Drizzle du dépôt de recommandations : une seule requête, repli par ligne en SQL.
 * `locale` est lue par le même `translated` que les champs : c'est la langue de la ligne servie
 * (`fr` quand la ligne `en` n'existe pas), jamais celle de la requête.
 */
export class DrizzleRecommendationsRepository implements RecommendationsRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  findAllPublished(locale: Locale): Promise<Recommendation[]> {
    const { fr, en } = translationAliases(recommendationsTranslations);

    return this.client.db
      .select({
        slug: recommendations.slug,
        authorName: recommendations.authorName,
        authorRole: translated(en, fr, 'authorRole'),
        relationship: translated(en, fr, 'relationship'),
        recommendedOn: recommendations.recommendedOn,
        paragraphs: translated(en, fr, 'paragraphs'),
        locale: translated(en, fr, 'locale'),
      })
      .from(recommendations)
      .innerJoin(fr, and(eq(fr.recommendationId, recommendations.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.recommendationId, recommendations.id), eq(en.locale, locale)))
      .where(and(eq(recommendations.published, true), isNull(recommendations.deletedAt)))
      .orderBy(asc(recommendations.sortOrder), asc(recommendations.id));
  }
}
