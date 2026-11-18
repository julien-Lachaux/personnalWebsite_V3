import {
  OpenApiGeneratorV32,
  type ResponseConfig,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas32';

import { ProblemDetailsSchema } from '../common/problem-details.js';
import { HealthResponseSchema } from '../health/health.js';

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
 * Routes décrites par le contrat. Chaque ressource (lot 2) ajoute ici ses entrées ;
 * les chemins sont relatifs au préfixe `/api/v1` (voir `servers`).
 */
const routes: RouteConfig[] = [
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
      '503': problemResponse('La base de données est injoignable.'),
    },
  },
];

/**
 * Schémas nommés publiés dans `components.schemas`, même s'ils ne sont pas encore référencés
 * par une route. Le nom vient de `.meta({ id })` (Zod 4 natif, sans patch de prototype).
 */
const namedSchemas = [ProblemDetailsSchema, HealthResponseSchema];

/** Génère le document OpenAPI 3.2.0 à partir des schémas Zod. */
export function createOpenApiDocument(): OpenApiDocument {
  const generator = new OpenApiGeneratorV32(
    [...namedSchemas, ...routes.map((route) => ({ type: 'route' as const, route }))],
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
    tags: [{ name: 'Système', description: 'Supervision et contrat' }],
  });
}

export type OpenApiDocument = OpenAPIObject;
