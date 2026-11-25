import { type Skill } from '../skills/skill.js';

export type ExperienceKind = 'employment' | 'freelance' | 'break' | 'mentoring';
export type ContractType = 'cdi' | 'freelance' | 'none';
export type WorkMode = 'onsite' | 'hybrid' | 'remote';

/** Compétence liée à une expérience : `shownInStack` à `false` pour un mot-clé caché (filtre du front). */
export interface ExperienceSkill extends Skill {
  readonly shownInStack: boolean;
}

/**
 * Expérience professionnelle (ou pause, mentorat), déjà traduite dans la langue demandée.
 * Les dates sont au format `YYYY-MM-DD` (premier jour du mois).
 */
export interface Experience {
  readonly slug: string;
  readonly kind: ExperienceKind;
  /** `null` pour une pause : pas d'employeur. */
  readonly company: string | null;
  readonly companyUrl: string | null;
  readonly logoPath: string | null;
  readonly logoAlt: string | null;
  readonly contractType: ContractType | null;
  readonly workMode: WorkMode | null;
  readonly dateStart: string;
  /** `null` = en cours. */
  readonly dateEnd: string | null;
  readonly jobTitle: string;
  readonly location: string | null;
  readonly summary: string;
  readonly achievements: readonly string[];
  readonly stackLabel: string | null;
  /**
   * Compétences publiées liées, affichées ou cachées, dans l'ordre de `experience_skills.sort_order`.
   */
  readonly skills: readonly ExperienceSkill[];
}
