import { type Locale } from '@siteperso/contracts';

import { type Recommendation } from '../../../domain/recommendations/recommendation.js';

/** Jeton d'injection du dépôt de recommandations. */
export const RECOMMENDATIONS_REPOSITORY = Symbol('RECOMMENDATIONS_REPOSITORY');

export interface RecommendationsRepository {
  /**
   * Recommandations publiées et non marquées supprimées, traduites (repli par ligne `en` → `fr`),
   * triées par `sort_order` puis `id`, chacune avec la langue de la ligne servie. Une requête.
   */
  findAllPublished(locale: Locale): Promise<Recommendation[]>;
}
