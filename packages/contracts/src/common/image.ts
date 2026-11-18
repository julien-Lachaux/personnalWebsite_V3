import { z } from 'zod';

/** Image statique servie par le front, toujours accompagnée d'un texte alternatif traduit. */
export const ImageSchema = z
  .strictObject({
    path: z
      .string()
      .min(1)
      .meta({
        description: "Chemin relatif d'un fichier statique servi par le front.",
        examples: ['/images/profile.webp'],
      }),
    alt: z
      .string()
      .min(1)
      .meta({
        description: 'Texte alternatif (accessibilité), dans la langue demandée.',
        examples: ['Portrait de profil'],
      }),
  })
  .meta({
    id: 'Image',
    description: 'Image statique avec son texte alternatif traduit.',
  });

export type Image = z.infer<typeof ImageSchema>;
