import { z } from 'zod';

import { CertificationSchema } from '../certifications/certifications.js';
import { LocaleSchema } from '../common/locale.js';
import { EducationSchema } from '../education/education.js';
import { ExperienceSchema } from '../experiences/experiences.js';
import { LanguageSchema } from '../languages/languages.js';
import { ProfileSchema } from '../profile/profile.js';
import { ProjectSchema } from '../projects/projects.js';
import { ResourceSchema } from '../resources/resources.js';
import { SkillGroupSchema } from '../skill-groups/skill-groups.js';
import { SocialLinkSchema } from '../social-links/social-links.js';
import { ToolSchema } from '../tools/tools.js';

/**
 * Réponse de `GET /cv` : agrégat de toutes les ressources en un appel (génération statique du
 * front). Les compétences ne sont pas répétées à plat : elles sont imbriquées dans `skillGroups`.
 */
export const CvSchema = z
  .strictObject({
    locale: LocaleSchema.meta({ description: 'Langue effectivement demandée (`lang`).' }),
    profile: ProfileSchema,
    socialLinks: z.array(SocialLinkSchema),
    skillGroups: z.array(SkillGroupSchema),
    experiences: z.array(ExperienceSchema),
    projects: z.array(ProjectSchema),
    tools: z.array(ToolSchema),
    resources: z.array(ResourceSchema),
    certifications: z.array(CertificationSchema),
    education: z.array(EducationSchema),
    languages: z.array(LanguageSchema),
  })
  .meta({ id: 'Cv', description: 'CV complet : agrégat de toutes les ressources.' });

export type Cv = z.infer<typeof CvSchema>;
