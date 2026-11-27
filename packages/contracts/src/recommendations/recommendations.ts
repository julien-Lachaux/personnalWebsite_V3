import { z } from 'zod';

import { IsoDateSchema } from '../common/date.js';
import { LocaleSchema } from '../common/locale.js';
import { SlugSchema } from '../common/slug.js';

/**
 * Recommandation professionnelle (citation), réponse de `GET /recommendations` triée par `sort_order`.
 * Le rôle de l'auteur, la relation et la citation viennent d'une seule ligne de traduction (repli par
 * ligne) : `locale` est la langue de cette ligne, `fr` quand la citation n'est pas traduite, même pour
 * `?lang=en`. Le front s'en sert pour poser l'attribut `lang` de la citation.
 */
export const RecommendationSchema = z
  .strictObject({
    slug: SlugSchema,
    authorName: z
      .string()
      .min(1)
      .meta({ description: "Nom de l'auteur de la recommandation.", examples: ['Prénom Nom'] }),
    authorRole: z
      .string()
      .min(1)
      .meta({ description: "Fonction de l'auteur.", examples: ['CTO'] }),
    relationship: z
      .string()
      .min(1)
      .meta({
        description: "Relation professionnelle entre l'auteur et Julien.",
        examples: ['Responsable direct de Julien'],
      }),
    // Date de la recommandation.
    recommendedOn: IsoDateSchema,
    paragraphs: z
      .array(z.string().min(1))
      .min(1)
      .meta({ description: 'Citation, un paragraphe par entrée (texte brut, au moins un).' }),
    locale: LocaleSchema.meta({
      description:
        "Langue de la ligne de traduction servie : `fr` quand la citation n'est pas traduite, même pour `?lang=en`. Le front s'en sert pour l'attribut `lang` de la citation.",
    }),
  })
  .meta({
    id: 'Recommendation',
    description:
      'Recommandation professionnelle ; `locale` est la langue de la ligne servie (`fr` en repli).',
  });

export type Recommendation = z.infer<typeof RecommendationSchema>;
