import { type Skill } from '../skills/skill.js';

/** Section « IA » du site (une seule ligne, `id = 1`), déjà traduite dans la langue demandée. */
export interface AiOverview {
  readonly title: string;
  readonly inProductLabel: string;
  /** Usages de l'IA dans le produit, un par élément. */
  readonly inProductItems: readonly string[];
  readonly dailyLabel: string;
  readonly dailyText: string;
  /** Compétences publiées liées, dans l'ordre de `ai_overview_skills.sort_order`. */
  readonly skills: readonly Skill[];
}
