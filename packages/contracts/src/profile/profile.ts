import { z } from 'zod';

import { ImageSchema } from '../common/image.js';

/**
 * Réponse de `GET /profile` (ligne unique `profile` + `profile_translations`).
 * Les propriétés JSON sont en camelCase (convention du contrat, voir README). Aucune donnée de
 * contact privée n'y figure : le contact est géré par le front (docs/01). L'objet est strict :
 * toute clé inconnue est refusée, pour que les tests e2e détectent une fuite de colonne.
 */
export const ProfileSchema = z
  .strictObject({
    firstName: z
      .string()
      .min(1)
      .meta({ examples: ['Prénom'] }),
    lastName: z
      .string()
      .min(1)
      .meta({ examples: ['Nom'] }),
    location: z
      .string()
      .min(1)
      .meta({
        description: 'Localisation publique.',
        examples: ['Melun, Île-de-France'],
      }),
    // Photo de profil et son texte alternatif.
    picture: ImageSchema,
    title: z
      .string()
      .min(1)
      .meta({
        description: 'Titre professionnel.',
        examples: ['Développeur full-stack TypeScript senior'],
      }),
    headline: z.string().meta({ description: "Phrase d'accroche." }),
    bio: z.string().meta({ description: 'Présentation (texte brut ou Markdown léger).' }),
    availability: z.string().meta({
      description: 'Statut de disponibilité.',
      examples: ['Disponible pour des missions'],
    }),
  })
  .meta({ id: 'Profile', description: 'Profil public, traduit selon `lang`.' });

export type Profile = z.infer<typeof ProfileSchema>;
