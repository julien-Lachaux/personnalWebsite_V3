import { type Locale } from '@siteperso/contracts';

import { type Experience } from '../../../domain/experiences/experience.js';

/** Jeton d'injection du dépôt d'expériences. */
export const EXPERIENCES_REPOSITORY = Symbol('EXPERIENCES_REPOSITORY');

export interface ExperiencesRepository {
  /**
   * Expériences publiées, traduites (repli `en` → `fr`), triées par `date_start` décroissant (puis
   * `sort_order`, puis `id`), chacune avec ses compétences publiées triées par
   * `experience_skills.sort_order`. Au plus deux requêtes (pas de N+1).
   */
  findAllPublished(locale: Locale): Promise<Experience[]>;
}
