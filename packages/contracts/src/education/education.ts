import { z } from 'zod';

import { SlugSchema } from '../common/slug.js';

/** Formation. Raffinement : `yearEnd` ne peut pas précéder `yearStart`. */
export const EducationSchema = z
  .strictObject({
    slug: SlugSchema,
    institution: z.string().min(1),
    yearStart: z.int().min(1950).max(2100),
    yearEnd: z
      .int()
      .min(1950)
      .max(2100)
      .nullable()
      .meta({ description: 'Fin ; `null` = en cours.' }),
    url: z.url().nullable().meta({ description: "Site de l'établissement." }),
    title: z.string().min(1),
    description: z
      .string()
      .nullable()
      .meta({ description: 'Détail de la formation ; `null` si absent.' }),
  })
  .refine((value) => value.yearEnd === null || value.yearEnd >= value.yearStart, {
    path: ['yearEnd'],
    error: 'yearEnd doit être supérieur ou égal à yearStart',
  })
  .meta({ id: 'Education', description: 'Formation.' });

export type Education = z.infer<typeof EducationSchema>;
