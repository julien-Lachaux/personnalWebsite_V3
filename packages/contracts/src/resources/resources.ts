import { z } from 'zod';

import { ImageSchema } from '../common/image.js';
import { nullable } from '../common/nullable.js';
import { SlugSchema } from '../common/slug.js';

/** Ressource recommandée (ex-favoris), éventuellement rattachée à un groupe de compétences. */
export const ResourceSchema = z
  .strictObject({
    slug: SlugSchema,
    url: z.url(),
    groupSlug: nullable(SlugSchema).meta({
      description: 'Slug du groupe de compétences associé ; `null` si aucun.',
    }),
    picture: nullable(ImageSchema).meta({ description: 'Visuel et son texte alternatif.' }),
    name: z.string().min(1),
    description: z.string(),
  })
  .meta({ id: 'Resource', description: 'Ressource recommandée.' });

export type Resource = z.infer<typeof ResourceSchema>;
