import {
  OpenApiGeneratorV32,
  type ResponseConfig,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas32';

import { z } from 'zod';

import { CertificationSchema } from '../certifications/certifications.js';
import { IsoDateSchema } from '../common/date.js';
import {
  CefrLevelSchema,
  ContractTypeSchema,
  ExperienceKindSchema,
  WorkModeSchema,
} from '../common/enums.js';
import { ImageSchema } from '../common/image.js';
import { LocaleQuerySchema, LocaleSchema } from '../common/locale.js';
import { ProblemDetailsSchema } from '../common/problem-details.js';
import { SlugSchema } from '../common/slug.js';
import { CvSchema } from '../cv/cv.js';
import { EducationSchema } from '../education/education.js';
import { ExperienceSchema } from '../experiences/experiences.js';
import { HealthResponseSchema } from '../health/health.js';
import { LanguageSchema } from '../languages/languages.js';
import { ProfileSchema } from '../profile/profile.js';
import { ProjectSchema } from '../projects/projects.js';
import { ResourceSchema } from '../resources/resources.js';
import { SkillGroupSchema } from '../skill-groups/skill-groups.js';
import { SkillSchema } from '../skills/skills.js';
import { SocialLinkSchema } from '../social-links/social-links.js';
import { ToolSchema } from '../tools/tools.js';

/** Version du contrat (API publique que le portage Rust devra honorer), indépendante des paquets. */
export const API_VERSION = '1.0.0';
export const API_PREFIX = '/api/v1';
/** Version d'OpenAPI émise : la plus haute que `utoipa` 6 (Rust) sait produire. */
export const OPENAPI_VERSION = '3.2.0';

/** Réponses d'erreur communes à tous les endpoints, au format problem+json. */
const problemResponse = (description: string): ResponseConfig => ({
  description,
  content: {
    'application/problem+json': { schema: ProblemDetailsSchema },
  },
});

/**
 * Routes décrites par le contrat. Les chemins sont relatifs au préfixe `/api/v1` (voir `servers`).
 * Une seule table décrit les 12 routes de contenu : même forme, même jeu de réponses d'erreur.
 */
interface ContentRoute {
  path: string;
  operationId: string;
  tag: string;
  summary: string;
  /** Description du `200` ; le schéma est celui de la ressource (objet ou tableau). */
  description: string;
  schema: z.ZodType;
}

const contentRoutes: ContentRoute[] = [
  {
    path: '/profile',
    operationId: 'getProfile',
    tag: 'Profil',
    summary: 'Profil public',
    description: 'Le profil, traduit selon `lang`.',
    schema: ProfileSchema,
  },
  {
    path: '/social-links',
    operationId: 'listSocialLinks',
    tag: 'Liens sociaux',
    summary: 'Liens vers les profils publics',
    description: 'Les liens publiés, par ordre de tri.',
    schema: z.array(SocialLinkSchema),
  },
  {
    path: '/skill-groups',
    operationId: 'listSkillGroups',
    tag: 'Groupes de compétences',
    summary: 'Groupes de compétences avec leurs compétences',
    description: 'Les groupes publiés, chacun avec ses compétences imbriquées.',
    schema: z.array(SkillGroupSchema),
  },
  {
    path: '/skills',
    operationId: 'listSkills',
    tag: 'Compétences',
    summary: 'Compétences à plat',
    description: 'Toutes les compétences publiées, par ordre de tri.',
    schema: z.array(SkillSchema),
  },
  {
    path: '/experiences',
    operationId: 'listExperiences',
    tag: 'Expériences',
    summary: 'Expériences avec leurs compétences',
    description: 'Les expériences publiées, de la plus récente à la plus ancienne.',
    schema: z.array(ExperienceSchema),
  },
  {
    path: '/projects',
    operationId: 'listProjects',
    tag: 'Projets',
    summary: 'Réalisations avec leurs compétences',
    description: 'Les projets publiés, par ordre de tri.',
    schema: z.array(ProjectSchema),
  },
  {
    path: '/tools',
    operationId: 'listTools',
    tag: 'Outils',
    summary: 'Outils du quotidien',
    description: 'Les outils publiés, par ordre de tri.',
    schema: z.array(ToolSchema),
  },
  {
    path: '/resources',
    operationId: 'listResources',
    tag: 'Ressources',
    summary: 'Ressources recommandées',
    description: 'Les ressources publiées, par ordre de tri.',
    schema: z.array(ResourceSchema),
  },
  {
    path: '/certifications',
    operationId: 'listCertifications',
    tag: 'Certifications',
    summary: 'Certifications',
    description: 'Les certifications publiées, par ordre de tri.',
    schema: z.array(CertificationSchema),
  },
  {
    path: '/education',
    operationId: 'listEducation',
    tag: 'Formations',
    summary: 'Formations',
    description: 'Les formations publiées, par ordre de tri.',
    schema: z.array(EducationSchema),
  },
  {
    path: '/languages',
    operationId: 'listLanguages',
    tag: 'Langues',
    summary: 'Langues parlées',
    description: 'Les langues publiées, par ordre de tri.',
    schema: z.array(LanguageSchema),
  },
  {
    path: '/cv',
    operationId: 'getCv',
    tag: 'CV',
    summary: 'CV complet en un appel',
    description: 'Agrégat de toutes les ressources, pour la génération statique du front.',
    schema: CvSchema,
  },
];

const tooManyRequests = problemResponse(
  'Trop de requêtes : limite de débit atteinte pour cette IP.',
);
const internalError = problemResponse('Erreur interne, sans détail technique.');

const contentRoute = (route: ContentRoute): RouteConfig => ({
  method: 'get',
  path: route.path,
  operationId: route.operationId,
  summary: route.summary,
  tags: [route.tag],
  request: { query: LocaleQuerySchema },
  responses: {
    '200': {
      description: route.description,
      content: { 'application/json': { schema: route.schema } },
    },
    '400': problemResponse('Paramètre de requête invalide (par exemple `lang` inconnu).'),
    '404': problemResponse('Ressource ou chemin introuvable.'),
    '429': tooManyRequests,
    '500': internalError,
  },
});

const routes: RouteConfig[] = [
  ...contentRoutes.map(contentRoute),
  {
    method: 'get',
    path: '/health',
    operationId: 'getHealth',
    summary: "État de l'API",
    tags: ['Système'],
    responses: {
      '200': {
        description: "L'API répond et sa base de données est joignable.",
        content: { 'application/json': { schema: HealthResponseSchema } },
      },
      '429': tooManyRequests,
      '500': internalError,
      '503': problemResponse('La base de données est injoignable.'),
    },
  },
];

/**
 * Schémas nommés publiés dans `components.schemas`, même s'ils ne sont pas référencés par une
 * route. Le nom vient de `.meta({ id })` (Zod 4 natif, sans patch de prototype).
 */
const namedSchemas = [
  ProblemDetailsSchema,
  HealthResponseSchema,
  LocaleSchema,
  SlugSchema,
  IsoDateSchema,
  ImageSchema,
  ExperienceKindSchema,
  ContractTypeSchema,
  WorkModeSchema,
  CefrLevelSchema,
  ProfileSchema,
  SocialLinkSchema,
  SkillSchema,
  SkillGroupSchema,
  ExperienceSchema,
  ProjectSchema,
  ToolSchema,
  ResourceSchema,
  CertificationSchema,
  EducationSchema,
  LanguageSchema,
  CvSchema,
];

/** Génère le document OpenAPI 3.2.0 à partir des schémas Zod. */
export function createOpenApiDocument(): OpenApiDocument {
  const generator = new OpenApiGeneratorV32(
    [
      ...namedSchemas.map((schema) => ({ type: 'schema' as const, schema })),
      ...routes.map((route) => ({ type: 'route' as const, route })),
    ],
    { sortComponents: 'alphabetically' },
  );

  return generator.generateDocument({
    openapi: OPENAPI_VERSION,
    info: {
      title: 'Site perso V3 : API de contenu',
      version: API_VERSION,
      description:
        'API publique en lecture seule exposant le contenu du CV (profil, compétences, expériences, ' +
        'projets…). Le contenu est multilingue (`?lang=fr|en`, défaut `fr`). Les erreurs suivent la ' +
        'RFC 9457 (`application/problem+json`).',
    },
    servers: [{ url: API_PREFIX, description: 'Préfixe de version de l’API' }],
    tags: [
      { name: 'Profil', description: 'Profil public' },
      { name: 'Liens sociaux', description: 'Profils publics en ligne' },
      { name: 'Groupes de compétences', description: 'Compétences regroupées par domaine' },
      { name: 'Compétences', description: 'Compétences techniques' },
      { name: 'Expériences', description: 'Parcours professionnel' },
      { name: 'Projets', description: 'Réalisations' },
      { name: 'Outils', description: 'Outils du quotidien' },
      { name: 'Ressources', description: 'Ressources recommandées' },
      { name: 'Certifications', description: 'Certifications obtenues' },
      { name: 'Formations', description: 'Parcours de formation' },
      { name: 'Langues', description: 'Langues parlées' },
      { name: 'CV', description: 'Agrégat de tout le contenu en un appel' },
      { name: 'Système', description: 'Supervision de l’API' },
    ],
  });
}

export type OpenApiDocument = OpenAPIObject;
