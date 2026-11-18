import { createDocument, type ZodOpenApiObject, type ZodOpenApiPathsObject } from 'zod-openapi';

import { ProblemDetailsSchema } from '../common/problem-details.js';
import { HealthResponseSchema } from '../health/health.js';

export const API_VERSION = '1.0.0';
export const API_PREFIX = '/api/v1';

/** Réponses d'erreur communes à tous les endpoints, au format problem+json. */
const problemResponse = (description: string) => ({
  description,
  content: {
    'application/problem+json': { schema: ProblemDetailsSchema },
  },
});

/**
 * Chemins décrits par le contrat. Chaque ressource (lot 2) ajoute ici son entrée ;
 * les chemins sont relatifs au préfixe `/api/v1` (voir `servers`).
 */
const paths: ZodOpenApiPathsObject = {
  '/health': {
    get: {
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
  },
};

/** Génère le document OpenAPI 3.1 à partir des schémas Zod. */
export function createOpenApiDocument(): ReturnType<typeof createDocument> {
  const document: ZodOpenApiObject = {
    openapi: '3.1.0',
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
    paths,
    components: {
      schemas: {
        ProblemDetails: ProblemDetailsSchema,
      },
    },
  };

  return createDocument(document);
}

export type OpenApiDocument = ReturnType<typeof createOpenApiDocument>;
