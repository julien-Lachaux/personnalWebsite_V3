import { z } from 'zod';

import { CefrLevelSchema } from '../common/enums.js';
import { nullable } from '../common/nullable.js';
import { SlugSchema } from '../common/slug.js';

/** Langue parlée. */
export const LanguageSchema = z
  .strictObject({
    slug: SlugSchema,
    code: z
      .string()
      .regex(/^[a-z]{2}$/)
      .meta({
        description: 'Code ISO 639-1 en minuscules.',
        examples: ['fr'],
      }),
    cefrLevel: nullable(CefrLevelSchema).meta({
      description: 'Niveau CECRL ; `null` pour la langue maternelle.',
    }),
    name: z
      .string()
      .min(1)
      .meta({ examples: ['Français'] }),
    levelLabel: z
      .string()
      .min(1)
      .meta({ examples: ['langue maternelle'] }),
  })
  .meta({ id: 'Language', description: 'Langue parlée.' });

export type Language = z.infer<typeof LanguageSchema>;
