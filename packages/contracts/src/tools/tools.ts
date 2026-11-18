import { z } from 'zod';

import { SlugSchema } from '../common/slug.js';
import { HttpUrlSchema } from '../common/url.js';

/** Outil du quotidien (IDE, API, services…). */
export const ToolSchema = z
  .strictObject({
    slug: SlugSchema,
    url: HttpUrlSchema.nullable().meta({ description: "Site de l'outil, s'il existe." }),
    iconPath: z
      .string()
      .min(1)
      .nullable()
      .meta({ description: "Chemin de l'icône statique, si disponible." }),
    name: z.string().min(1),
    family: z
      .string()
      .min(1)
      .meta({ description: "Famille d'outils.", examples: ['IDE', 'API'] }),
    description: z.string(),
  })
  .meta({ id: 'Tool', description: 'Outil du quotidien.' });

export type Tool = z.infer<typeof ToolSchema>;
