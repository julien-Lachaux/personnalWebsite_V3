import { z } from 'zod';

import { ImageSchema } from '../common/image.js';
import { nullable } from '../common/nullable.js';
import { SlugSchema } from '../common/slug.js';
import { SkillSchema } from '../skills/skills.js';

/** Réalisation (projet) présentée sur le site. */
export const ProjectSchema = z
  .strictObject({
    slug: SlugSchema,
    url: z.url().meta({ description: 'Adresse publique du projet.' }),
    repoUrl: z.url().meta({ description: 'Adresse du dépôt de code.' }),
    imageDesktop: nullable(ImageSchema).meta({ description: "Capture d'écran bureau." }),
    imageMobile: nullable(ImageSchema).meta({ description: "Capture d'écran mobile." }),
    year: z.int().min(1990).max(2100).meta({ description: 'Année de réalisation.' }),
    title: z.string().min(1),
    description: z.string(),
    skills: z.array(SkillSchema).meta({ description: 'Compétences mobilisées, par ordre de tri.' }),
  })
  .meta({ id: 'Project', description: 'Réalisation (projet).' });

export type Project = z.infer<typeof ProjectSchema>;
