import { type Locale } from '@siteperso/contracts';

import { type AiOverview } from '../../../domain/ai-overview/ai-overview.js';

/** Jeton d'injection du dépôt de la section IA. */
export const AI_OVERVIEW_REPOSITORY = Symbol('AI_OVERVIEW_REPOSITORY');

export interface AiOverviewRepository {
  /**
   * Section IA traduite (repli par ligne `en` → `fr`) avec ses compétences publiées liées, ou `null`
   * si la ligne n'existe pas, est marquée supprimée ou n'a pas de traduction `fr`. Deux requêtes.
   */
  findAiOverview(locale: Locale): Promise<AiOverview | null>;
}
