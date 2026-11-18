import { type Locale } from '@siteperso/contracts';

import { type SkillGroup } from '../../../domain/skill-groups/skill-group.js';

/** Jeton d'injection du dépôt de groupes de compétences. */
export const SKILL_GROUPS_REPOSITORY = Symbol('SKILL_GROUPS_REPOSITORY');

export interface SkillGroupsRepository {
  /**
   * Groupes publiés triés par `sort_order` puis `id`, chacun avec ses compétences publiées triées
   * par `sort_order` puis `id`, traduits (repli `en` → `fr`). Au plus deux requêtes (pas de N+1).
   */
  findAllPublished(locale: Locale): Promise<SkillGroup[]>;
}
