import { type Locale } from '@siteperso/contracts';

import { type Resource } from '../../../domain/resources/resources.js';

/** Jeton d'injection du dépôt des ressources. */
export const RESOURCES_REPOSITORY = Symbol('RESOURCES_REPOSITORY');

/** Port de lecture des ressources recommandées. */
export interface ResourcesRepository {
  /**
   * Ressources publiées triées par `sort_order` puis `id`, `groupSlug` résolu par jointure sur
   * `skill_groups`, textes dans `locale` (repli `fr` fait par le dépôt).
   */
  findAllPublished(locale: Locale): Promise<Resource[]>;
}
