import { z } from 'zod';

/** Motif d'un slug : minuscules, chiffres, séparés par des tirets simples. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Identifiant stable et lisible d'une entité (clé naturelle des seeds, jamais traduit). */
export const SlugSchema = z
  .string()
  .regex(SLUG_PATTERN)
  .meta({
    id: 'Slug',
    description:
      'Identifiant stable en minuscules, chiffres et tirets (`^[a-z0-9]+(-[a-z0-9]+)*$`).',
    examples: ['typescript'],
  });

export type Slug = z.infer<typeof SlugSchema>;
