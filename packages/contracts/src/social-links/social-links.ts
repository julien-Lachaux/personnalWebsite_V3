import { z } from 'zod';

import { SlugSchema } from '../common/slug.js';

/** Lien vers un profil public (réseau professionnel, dépôt de code, site personnel…). */
export const SocialLinkSchema = z
  .strictObject({
    slug: SlugSchema,
    kind: z
      .string()
      .min(1)
      .meta({
        description: 'Type de lien, ouvert : `github`, `linkedin`, `website`…',
        examples: ['github'],
      }),
    url: z.url().meta({ examples: ['https://github.com/example'] }),
    label: z
      .string()
      .min(1)
      .meta({ description: 'Libellé affiché.', examples: ['GitHub'] }),
  })
  .meta({ id: 'SocialLink', description: 'Lien vers un profil public.' });

export type SocialLink = z.infer<typeof SocialLinkSchema>;
