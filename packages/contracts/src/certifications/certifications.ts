import { z } from 'zod';

import { SlugSchema } from '../common/slug.js';
import { HttpUrlSchema } from '../common/url.js';

/** Certification obtenue. */
export const CertificationSchema = z
  .strictObject({
    slug: SlugSchema,
    issuer: z.string().min(1).meta({ description: 'Organisme émetteur.' }),
    year: z.int().min(1990).max(2100).meta({ description: "Année d'obtention." }),
    url: HttpUrlSchema.nullable().meta({ description: 'Lien de vérification ; `null` si absent.' }),
    name: z.string().min(1),
  })
  .meta({ id: 'Certification', description: 'Certification.' });

export type Certification = z.infer<typeof CertificationSchema>;
