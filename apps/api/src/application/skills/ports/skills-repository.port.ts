import { type Locale } from '@siteperso/contracts';

import { type Skill } from '../../../domain/skills/skill.js';

/** Jeton d'injection du dépôt de compétences. */
export const SKILLS_REPOSITORY = Symbol('SKILLS_REPOSITORY');

export interface SkillsRepository {
  /**
   * Compétences publiées (dont le groupe est publié), traduites (repli `en` → `fr`), à plat :
   * triées par ordre du groupe, puis `sort_order` de la compétence, puis `id`.
   */
  findAllPublished(locale: Locale): Promise<Skill[]>;
}
