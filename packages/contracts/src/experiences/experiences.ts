import { z } from 'zod';

import { IsoDateSchema } from '../common/date.js';
import { ContractTypeSchema, ExperienceKindSchema, WorkModeSchema } from '../common/enums.js';
import { ImageSchema } from '../common/image.js';
import { SlugSchema } from '../common/slug.js';
import { SkillSchema } from '../skills/skills.js';

/**
 * Expérience professionnelle (ou pause, mentorat). Triée par `dateStart` décroissant par défaut.
 * Les champs `null` sont toujours présents dans la réponse, jamais omis.
 */
export const ExperienceSchema = z
  .strictObject({
    slug: SlugSchema,
    kind: ExperienceKindSchema,
    company: z
      .string()
      .min(1)
      .nullable()
      .meta({ description: 'Employeur ; `null` pour une pause.' }),
    companyUrl: z.url().nullable().meta({ description: "Site de l'employeur." }),
    logo: ImageSchema.nullable().meta({
      description: "Logo de l'employeur et son texte alternatif.",
    }),
    contractType: ContractTypeSchema.nullable(),
    workMode: WorkModeSchema.nullable(),
    dateStart: IsoDateSchema.meta({ description: 'Début (premier jour du mois).' }),
    dateEnd: IsoDateSchema.nullable().meta({ description: 'Fin ; `null` = en cours.' }),
    jobTitle: z
      .string()
      .min(1)
      .meta({ examples: ['Développeur full-stack'] }),
    location: z.string().min(1).nullable().meta({ description: 'Lieu de travail.' }),
    summary: z.string().meta({ description: "Résumé de l'expérience." }),
    achievements: z
      .array(z.string())
      .meta({ description: 'Réalisations marquantes, une par entrée.' }),
    stackLabel: z.string().min(1).nullable().meta({
      description:
        'Libellé affiché devant la pile technique (ex. « Huile de coude » pour la pause).',
    }),
    skills: z.array(SkillSchema).meta({ description: 'Compétences mobilisées, par ordre de tri.' }),
  })
  .meta({ id: 'Experience', description: 'Expérience professionnelle.' });

export type Experience = z.infer<typeof ExperienceSchema>;
