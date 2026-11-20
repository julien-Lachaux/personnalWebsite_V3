import { z } from 'zod';

import { IsoDateSchema } from '../common/date.js';
import { ContractTypeSchema, ExperienceKindSchema, WorkModeSchema } from '../common/enums.js';
import { ImageSchema } from '../common/image.js';
import { nullable } from '../common/nullable.js';
import { SlugSchema } from '../common/slug.js';
import { SkillSchema } from '../skills/skills.js';
import { HttpUrlSchema } from '../common/url.js';

/**
 * Compétence liée à une expérience (`experience_skills`) : la compétence entière, plus son affichage.
 * Les compétences cachées (`shownInStack = false`) ne sont pas des puces de la pile : ce sont des
 * mots-clés que le front utilise pour son filtre par techno.
 */
export const ExperienceSkillSchema = z
  .strictObject({
    ...SkillSchema.shape,
    shownInStack: z.boolean().meta({
      description:
        "`true` : puce affichée dans la pile de l'expérience ; `false` : mot-clé caché, servi pour le filtre.",
    }),
  })
  .meta({
    id: 'ExperienceSkill',
    description: 'Compétence liée à une expérience, avec son affichage dans la pile.',
  });

export type ExperienceSkill = z.infer<typeof ExperienceSkillSchema>;

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
    companyUrl: HttpUrlSchema.nullable().meta({ description: "Site de l'employeur." }),
    logo: nullable(ImageSchema).meta({
      description: "Logo de l'employeur et son texte alternatif ; `null` si absent.",
    }),
    contractType: nullable(ContractTypeSchema),
    workMode: nullable(WorkModeSchema),
    // Premier jour du mois.
    dateStart: IsoDateSchema,
    // `null` = en cours.
    dateEnd: nullable(IsoDateSchema),
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
    skills: z.array(ExperienceSkillSchema).meta({
      description:
        'Compétences liées, par ordre de tri : puces de la pile (`shownInStack`) et mots-clés cachés.',
    }),
  })
  .meta({ id: 'Experience', description: 'Expérience professionnelle.' });

export type Experience = z.infer<typeof ExperienceSchema>;
