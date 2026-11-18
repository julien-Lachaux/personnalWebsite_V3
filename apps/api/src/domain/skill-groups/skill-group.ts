import { type Skill } from '../skills/skill.js';

/** Groupe de compétences publié, déjà traduit, avec ses compétences publiées (ordre du dépôt). */
export interface SkillGroup {
  readonly slug: string;
  readonly name: string;
  /** `null` quand le groupe n'a pas de description. */
  readonly description: string | null;
  readonly skills: readonly Skill[];
}
