import { type Locale, type Recommendation as RecommendationResponse } from '@siteperso/contracts';

import { type RecommendationsRepository } from './ports/recommendations-repository.port.js';

/** Cas d'usage : recommandations publiées, dans l'ordre du dépôt. Classe pure, sans décorateur. */
export class ListRecommendationsUseCase {
  constructor(private readonly recommendations: RecommendationsRepository) {}

  async execute(locale: Locale): Promise<RecommendationResponse[]> {
    const recommendations = await this.recommendations.findAllPublished(locale);
    return recommendations.map((recommendation) => ({
      slug: recommendation.slug,
      authorName: recommendation.authorName,
      authorRole: recommendation.authorRole,
      relationship: recommendation.relationship,
      recommendedOn: recommendation.recommendedOn,
      paragraphs: [...recommendation.paragraphs],
      locale: recommendation.locale,
    }));
  }
}
