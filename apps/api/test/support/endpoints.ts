import {
  CertificationSchema,
  CvSchema,
  EducationSchema,
  ExperienceSchema,
  LanguageSchema,
  ProfileSchema,
  ProjectSchema,
  RecommendationSchema,
  ResourceSchema,
  SkillGroupSchema,
  SkillSchema,
  SocialLinkSchema,
  ToolSchema,
} from '@siteperso/contracts';
import { z } from 'zod';

export interface Endpoint {
  /** Nom de la ressource (libellé de test ; clé dans `/cv` quand elle existe). */
  name: string;
  /** Chemin complet, sans query. */
  path: string;
  /** Schéma Zod de la réponse 200. */
  schema: z.ZodType;
  /** Forme de la réponse. */
  shape: 'object' | 'list';
  /** Nombre d'éléments attendu sur la base seedée (`null` pour un objet). */
  seededCount: number | null;
}

/** Les 13 routes de contenu en lecture seule, sous `/api/v1`. */
export const ENDPOINTS: readonly Endpoint[] = [
  {
    name: 'profile',
    path: '/api/v1/profile',
    schema: ProfileSchema,
    shape: 'object',
    seededCount: null,
  },
  {
    name: 'socialLinks',
    path: '/api/v1/social-links',
    schema: z.array(SocialLinkSchema),
    shape: 'list',
    seededCount: 2,
  },
  {
    name: 'skillGroups',
    path: '/api/v1/skill-groups',
    schema: z.array(SkillGroupSchema),
    shape: 'list',
    seededCount: 7,
  },
  {
    name: 'skills',
    path: '/api/v1/skills',
    schema: z.array(SkillSchema),
    shape: 'list',
    seededCount: 34,
  },
  {
    name: 'experiences',
    path: '/api/v1/experiences',
    schema: z.array(ExperienceSchema),
    shape: 'list',
    seededCount: 8,
  },
  {
    name: 'projects',
    path: '/api/v1/projects',
    schema: z.array(ProjectSchema),
    shape: 'list',
    seededCount: 0,
  },
  {
    name: 'tools',
    path: '/api/v1/tools',
    schema: z.array(ToolSchema),
    shape: 'list',
    seededCount: 0,
  },
  {
    name: 'resources',
    path: '/api/v1/resources',
    schema: z.array(ResourceSchema),
    shape: 'list',
    seededCount: 0,
  },
  {
    name: 'certifications',
    path: '/api/v1/certifications',
    schema: z.array(CertificationSchema),
    shape: 'list',
    seededCount: 3,
  },
  {
    name: 'education',
    path: '/api/v1/education',
    schema: z.array(EducationSchema),
    shape: 'list',
    seededCount: 3,
  },
  {
    name: 'languages',
    path: '/api/v1/languages',
    schema: z.array(LanguageSchema),
    shape: 'list',
    seededCount: 2,
  },
  {
    name: 'recommendations',
    path: '/api/v1/recommendations',
    schema: z.array(RecommendationSchema),
    shape: 'list',
    seededCount: 3,
  },
  { name: 'cv', path: '/api/v1/cv', schema: CvSchema, shape: 'object', seededCount: null },
];

/** Toutes les tables de traductions (`<table>_translations`). */
export const TRANSLATION_TABLES = [
  'profile_translations',
  'social_links_translations',
  'skill_groups_translations',
  'skills_translations',
  'experiences_translations',
  'projects_translations',
  'tools_translations',
  'resources_translations',
  'certifications_translations',
  'education_translations',
  'languages_translations',
  'recommendations_translations',
] as const;

export function withLang(path: string, lang?: string): string {
  return lang === undefined ? path : `${path}?lang=${lang}`;
}
