import { z } from 'zod';

import { SlugSchema } from '../common/slug.js';
import { SkillSchema } from '../skills/skills.js';

/** Groupe de compétences avec ses compétences imbriquées (triées par `sort_order`). */
export const SkillGroupSchema = z
  .strictObject({
    slug: SlugSchema,
    name: z
      .string()
      .min(1)
      .meta({ examples: ['Langages'] }),
    description: z
      .string()
      .nullable()
      .meta({ description: 'Présentation du groupe ; `null` si le groupe n’en a pas.' }),
    skills: z.array(SkillSchema).meta({ description: 'Compétences du groupe.' }),
  })
  .meta({ id: 'SkillGroup', description: 'Groupe de compétences et ses compétences.' });

export type SkillGroup = z.infer<typeof SkillGroupSchema>;
