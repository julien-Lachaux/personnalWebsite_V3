import { z } from 'zod';

import { SlugSchema } from '../common/slug.js';

/** Compétence technique, rattachée à un groupe. */
export const SkillSchema = z
  .strictObject({
    slug: SlugSchema,
    name: z
      .string()
      .min(1)
      .meta({
        description: 'Nom affiché (le plus souvent un nom propre, identique en `en`).',
        examples: ['TypeScript'],
      }),
    level: z.int().min(1).max(5).meta({ description: 'Niveau de maîtrise, de 1 à 5.' }),
    icon: z
      .string()
      .min(1)
      .meta({
        description: 'Slug devicon ou chemin SVG.',
        examples: ['typescript'],
      }),
    iconPath: z.string().min(1).nullable().meta({
      description: "Chemin d'une icône statique propre ; `null` si `icon` suffit.",
    }),
    // Slug du groupe de compétences parent.
    groupSlug: SlugSchema,
    mainStackOrder: z
      .int()
      .min(1)
      .nullable()
      .meta({
        description:
          'Rang dans la stack principale (1 = premier, unique) ; `null` hors de la stack principale.',
        examples: [1],
      }),
  })
  .meta({ id: 'Skill', description: 'Compétence technique.' });

export type Skill = z.infer<typeof SkillSchema>;
