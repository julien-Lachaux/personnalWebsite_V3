import { z } from 'zod';

import { ImageSchema } from '../common/image.js';

/**
 * Chemin d'un fichier statique servi par le front, relatif à la racine du site : un seul `/` en tête,
 * aucun espace. Écarte `javascript:`, `data:`, une URL absolue et une URL sans protocole (`//hôte`),
 * que le front rendrait dans un `href`.
 */
const SITE_PATH_PATTERN = /^\/[^/\s]\S*$/;

/** Texte affiché, jamais vide. */
const text = (description: string, example: string) =>
  z
    .string()
    .min(1)
    .meta({ description, examples: [example] });

/**
 * Réponse de `GET /profile` (ligne unique `profile` + `profile_translations`).
 * Les propriétés JSON sont en camelCase (convention du contrat, voir README). Aucune donnée de
 * contact privée n'y figure : le contact est géré par le front (docs/01). L'objet est strict :
 * toute clé inconnue est refusée, pour que les tests e2e détectent une fuite de colonne.
 * Tous les champs traduits viennent de la même ligne de traduction (repli par ligne).
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
    title: text('Titre professionnel.', 'Développeur full-stack'),
    titleBadge: text('Pastille accolée au titre.', 'senior'),
    taglines: z
      .array(z.string().min(1))
      .min(1)
      .meta({
        description: "Phrases d'accroche, une par entrée (au moins une).",
        examples: [['Première accroche', 'Seconde accroche']],
      }),
    intro: text('Introduction (texte brut).', 'Depuis 2017, je conçois des API.'),
    mission: text('Mission recherchée (texte brut).', 'Mettre ce savoir-faire au service…'),
    currentActivity: text('Activité du moment (« en ce moment »).', 'Bénévolat'),
    seekingFormat: text('Format de poste recherché.', 'Temps partiel ou missions freelance'),
    seekingLocation: text('Lieu de travail recherché.', 'Paris · hybride ou à distance'),
    seekingAvailability: text('Disponibilité.', 'Immédiate'),
    cvPath: z
      .string()
      .regex(SITE_PATH_PATTERN)
      .meta({
        description:
          'Chemin du CV en PDF, propre à la langue, servi par le front : relatif à la racine du site (un seul `/` en tête), sans espace.',
        examples: ['/cv/cv-fr.pdf'],
      }),
  })
  .meta({ id: 'Profile', description: 'Profil public, traduit selon `lang`.' });

export type Profile = z.infer<typeof ProfileSchema>;
