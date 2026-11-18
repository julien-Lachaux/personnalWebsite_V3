import { z } from 'zod';

import { ImageSchema } from '../common/image.js';
import { SlugSchema } from '../common/slug.js';

/** Ressource recommandée (ex-favoris), éventuellement rattachée à un groupe de compétences. */
export const ResourceSchema = z
  .strictObject({
    slug: SlugSchema,
    url: z.url(),
    groupSlug: SlugSchema.nullable().meta({
      description: 'Slug du groupe de compétences associé ; `null` si aucun.',
    }),
    picture: ImageSchema.nullable().meta({ description: 'Visuel et son texte alternatif.' }),
    name: z.string().min(1),
    description: z.string(),
  })
  .meta({ id: 'Resource', description: 'Ressource recommandée.' });

export type Resource = z.infer<typeof ResourceSchema>;
