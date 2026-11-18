import { z } from 'zod';

/** Nature d'une expérience ; la pause professionnelle est un `break`. */
export const EXPERIENCE_KINDS = ['employment', 'freelance', 'break', 'mentoring'] as const;
/** Type de contrat (`none` : pas de contrat, par exemple une pause). */
export const CONTRACT_TYPES = ['cdi', 'freelance', 'none'] as const;
/** Mode de travail. */
export const WORK_MODES = ['onsite', 'hybrid', 'remote'] as const;
/** Niveaux du Cadre européen commun de référence pour les langues. */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const ExperienceKindSchema = z.enum(EXPERIENCE_KINDS).meta({
  id: 'ExperienceKind',
  description: "Nature de l'expérience. La pause professionnelle est un `break`.",
  examples: ['employment'],
});

export const ContractTypeSchema = z.enum(CONTRACT_TYPES).meta({
  id: 'ContractType',
  description: 'Type de contrat.',
  examples: ['cdi'],
});

export const WorkModeSchema = z.enum(WORK_MODES).meta({
  id: 'WorkMode',
  description: 'Mode de travail : sur site, hybride ou à distance.',
  examples: ['hybrid'],
});

export const CefrLevelSchema = z.enum(CEFR_LEVELS).meta({
  id: 'CefrLevel',
  description: 'Niveau CECRL (Cadre européen commun de référence pour les langues).',
  examples: ['C1'],
});

export type ExperienceKind = z.infer<typeof ExperienceKindSchema>;
export type ContractType = z.infer<typeof ContractTypeSchema>;
export type WorkMode = z.infer<typeof WorkModeSchema>;
export type CefrLevel = z.infer<typeof CefrLevelSchema>;
