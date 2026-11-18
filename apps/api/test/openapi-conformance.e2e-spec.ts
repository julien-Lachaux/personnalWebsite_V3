import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PROFILE_REPOSITORY } from '../src/application/profile/ports/profile-repository.port.js';
import { ENDPOINTS, withLang } from './support/endpoints.js';
import { appWithOverrides } from './support/override-app.js';
import { expectProblem } from './support/problem.js';
import { startTestApp } from './support/test-app.js';
import { validate } from './support/validate.js';

// Alias récursif (une signature d'index est nécessaire, `Record` serait circulaire).
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface OpenApiDocument {
  openapi: string;
  paths: Record<
    string,
    {
      get: {
        operationId: string;
        responses: Record<string, { content?: Record<string, { schema: Json }> }>;
      };
    }
  >;
  components: { schemas: Record<string, Json> };
}

/** Préfixe des chemins du document (`servers[0].url`). */
const PREFIX = '/api/v1';

const distOpenApiPath = fileURLToPath(
  new URL('../../../packages/contracts/dist/openapi.json', import.meta.url),
);

/**
 * Convertit un schéma OpenAPI en schéma JSON autonome (2020-12) : `#/components/schemas/X`
 * devient `#/$defs/X`, et `additionalProperties: false` est FORCÉ sur tout objet qui déclare des
 * `properties` (le document le met déjà ; on ne s'y fie pas).
 */
function toStrictJsonSchema(node: Json): Json {
  if (Array.isArray(node)) {
    return node.map(toStrictJsonSchema);
  }
  if (typeof node !== 'object' || node === null) {
    return node;
  }
  const copy: Record<string, Json> = {};
  for (const [key, value] of Object.entries(node)) {
    copy[key] =
      key === '$ref' && typeof value === 'string'
        ? value.replace('#/components/schemas/', '#/$defs/')
        : toStrictJsonSchema(value);
  }
  if ('properties' in copy) {
    copy['additionalProperties'] = false;
  }
  return copy;
}

describe('Conformité des réponses au document OpenAPI servi', () => {
  let app: NestFastifyApplication;
  let document: OpenApiDocument;
  let ajv: Ajv2020;
  const previousMax = process.env['RATE_LIMIT_MAX'];

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX'] = '100000';
    app = await startTestApp();
    document = (await app.inject({ method: 'GET', url: '/api/v1/docs.json' })).json();
    ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats.default(ajv);
  });

  afterAll(async () => {
    await app.close();
    if (previousMax === undefined) {
      delete process.env['RATE_LIMIT_MAX'];
    } else {
      process.env['RATE_LIMIT_MAX'] = previousMax;
    }
  });

  /** Fonction de validation Ajv du schéma de la réponse `status` d'une route du document. */
  function compileResponse(path: string, status: string, mediaType: string): ValidateFunction {
    const route = document.paths[path.replace(PREFIX, '')];
    const schema = route?.get.responses[status]?.content?.[mediaType]?.schema;
    if (schema === undefined) {
      throw new Error(`Réponse ${status} (${mediaType}) absente du document pour ${path}`);
    }
    const $defs = toStrictJsonSchema(document.components.schemas);
    return ajv.compile({ $defs, ...(toStrictJsonSchema(schema) as object) });
  }

  function expectAjv(validateBody: ValidateFunction, body: unknown): void {
    const valid = validateBody(body);
    expect(valid, JSON.stringify(validateBody.errors, null, 2)).toBe(true);
  }

  it('couvre les 12 routes de contenu', () => {
    expect(ENDPOINTS).toHaveLength(12);
  });

  describe.each(ENDPOINTS)('$path', (endpoint) => {
    it.each(['fr', 'en'])(
      '?lang=%s : conforme au schéma Zod strict ET au schéma JSON du document',
      async (lang) => {
        const response = await app.inject({ method: 'GET', url: withLang(endpoint.path, lang) });

        expect(response.statusCode).toBe(200);
        validate(endpoint.schema, response.json());
        expectAjv(compileResponse(endpoint.path, '200', 'application/json'), response.json());
      },
    );

    it('déclare 400, 404, 429 et 500 en problem+json dans le document', () => {
      const responses = document.paths[endpoint.path.replace(PREFIX, '')]?.get.responses ?? {};

      for (const status of ['400', '404', '429', '500']) {
        expect(
          responses[status]?.content?.['application/problem+json']?.schema,
          `${status} sur ${endpoint.path}`,
        ).toStrictEqual({ $ref: '#/components/schemas/ProblemDetails' });
      }
    });

    it('un 400 réel est conforme au schéma problem+json déclaré pour la route', async () => {
      const response = await app.inject({ method: 'GET', url: withLang(endpoint.path, 'de') });

      expectProblem(response, 400);
      expectAjv(compileResponse(endpoint.path, '400', 'application/problem+json'), response.json());
    });

    it('un champ ajouté artificiellement est rejeté par le schéma JSON (test négatif)', async () => {
      const response = await app.inject({ method: 'GET', url: endpoint.path });
      const body = response.json<Record<string, unknown> | Record<string, unknown>[]>();
      const validateBody = compileResponse(endpoint.path, '200', 'application/json');

      expectAjv(validateBody, body);
      // Liste vide sur la base seedée (projects, tools, resources) : un élément ne contenant que
      // le champ en trop, invalide par construction.
      const polluted: unknown = Array.isArray(body)
        ? body.length === 0
          ? [{ champExtra: 1 }]
          : body.map((item, index) => (index === 0 ? { ...item, champExtra: 1 } : item))
        : { ...body, champExtra: 1 };

      expect(validateBody(polluted)).toBe(false);
      expect(() => validate(endpoint.schema, polluted)).toThrow();
    });
  });

  it('health : 200, 429, 500 et 503 déclarés, réponse conforme', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expectAjv(compileResponse('/api/v1/health', '200', 'application/json'), response.json());
    const responses = document.paths['/health']?.get.responses ?? {};
    expect(Object.keys(responses).sort()).toEqual(['200', '429', '500', '503']);
  });

  it('le contrat OpenAPI servi est en 3.2.0 et déclare 13 routes GET', () => {
    expect(document.openapi).toBe('3.2.0');
    expect(Object.keys(document.paths)).toHaveLength(13);
  });

  it('GET /api/v1/docs.json est strictement égal à packages/contracts/dist/openapi.json', async () => {
    const served = (await app.inject({ method: 'GET', url: '/api/v1/docs.json' })).json<unknown>();
    const exported = JSON.parse(readFileSync(distOpenApiPath, 'utf8')) as unknown;

    expect(served).toStrictEqual(exported);
  });

  describe('doublure de dépôt qui renvoie un champ en trop', () => {
    it('l’API refuse de servir la réponse (500 générique) au lieu de la laisser fuiter', async () => {
      const real = (await app.inject({ method: 'GET', url: '/api/v1/profile' })).json<
        Record<string, unknown>
      >();
      const polluted = await appWithOverrides([
        [
          PROFILE_REPOSITORY,
          { findProfile: () => Promise.resolve({ ...real, champExtra: 'fuite' }) },
        ],
      ]);
      try {
        const response = await polluted.inject({ method: 'GET', url: '/api/v1/profile' });

        expectProblem(response, 500);
        expect(response.body).not.toContain('champExtra');
        expect(response.body).not.toContain('fuite');
      } finally {
        await polluted.close();
      }
    });
  });
});
