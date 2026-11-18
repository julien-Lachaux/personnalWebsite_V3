import { validate } from '@scalar/openapi-parser';
import { describe, expect, it } from 'vitest';

import { API_VERSION, createOpenApiDocument, OPENAPI_VERSION } from './document.js';

describe('createOpenApiDocument', () => {
  const document = createOpenApiDocument();

  it('produit un document OpenAPI 3.2.0 (plus haute version émise par utoipa côté Rust)', () => {
    expect(OPENAPI_VERSION).toBe('3.2.0');
    expect(document.openapi).toBe('3.2.0');
    expect(JSON.stringify(document)).toContain('"openapi":"3.2.0"');
  });

  it('porte la version 1.0.0 du contrat et le préfixe /api/v1', () => {
    expect(API_VERSION).toBe('1.0.0');
    expect(document.info.version).toBe('1.0.0');
    expect(document.info.title).toContain('API');
    expect(document.servers?.[0]?.url).toBe('/api/v1');
  });

  it('décrit GET /health avec ses réponses 200 et 503 par référence', () => {
    const operation = document.paths?.['/health']?.get;
    expect(operation?.operationId).toBe('getHealth');
    expect(operation?.responses?.['200']).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
    });
    expect(operation?.responses?.['503']).toMatchObject({
      content: {
        'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
      },
    });
  });

  it('expose les schémas nommés dans components', () => {
    const schemas = document.components?.schemas ?? {};
    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining(['ProblemDetails', 'HealthResponse']),
    );
    expect(schemas['ProblemDetails']).toMatchObject({
      type: 'object',
      required: ['type', 'title', 'status'],
      properties: { status: { type: 'integer', minimum: 100, maximum: 599 } },
    });
  });

  it('est sérialisable en JSON sans perte', () => {
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });

  it('est valide au sens de la spécification OpenAPI 3.2', async () => {
    const result = await validate(structuredClone(document) as never);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.version).toBe('3.2');
  });

  const expectedPaths = [
    '/certifications',
    '/cv',
    '/education',
    '/experiences',
    '/health',
    '/languages',
    '/profile',
    '/projects',
    '/resources',
    '/skill-groups',
    '/skills',
    '/social-links',
    '/tools',
  ];

  it('déclare exactement les 13 chemins, relatifs à /api/v1, sans /docs.json', () => {
    expect(Object.keys(document.paths ?? {}).sort()).toEqual(expectedPaths);
    expect(JSON.stringify(document)).not.toContain('docs.json');
  });

  it('porte le paramètre lang (Locale) sur 12 chemins, pas sur /health', () => {
    for (const path of expectedPaths) {
      const parameters = document.paths?.[path]?.get?.parameters ?? [];
      const lang = parameters.find((p) => 'name' in p && p.name === 'lang');
      if (path === '/health') {
        expect(lang).toBeUndefined();
      } else {
        expect(lang).toMatchObject({
          in: 'query',
          required: false,
          schema: { $ref: '#/components/schemas/Locale' },
        });
      }
    }
  });

  it('documente 200, 400, 404, 429 et 500 (503 pour /health) avec problem+json', () => {
    for (const path of expectedPaths) {
      const responses = document.paths?.[path]?.get?.responses ?? {};
      const expected =
        path === '/health' ? ['200', '429', '500', '503'] : ['200', '400', '404', '429', '500'];
      expect(Object.keys(responses).sort()).toEqual(expected);
      for (const status of expected.filter((code) => code !== '200')) {
        expect(responses[status]).toMatchObject({
          content: {
            'application/problem+json': {
              schema: { $ref: '#/components/schemas/ProblemDetails' },
            },
          },
        });
      }
    }
  });

  it('référence la ressource en 200 : objet pour /profile et /cv, tableau pour les autres', () => {
    const schemaOf = (path: string) =>
      (
        document.paths?.[path]?.get?.responses?.['200'] as {
          content: Record<string, { schema: unknown }>;
        }
      ).content['application/json']?.schema;
    expect(schemaOf('/profile')).toEqual({ $ref: '#/components/schemas/Profile' });
    expect(schemaOf('/cv')).toEqual({ $ref: '#/components/schemas/Cv' });
    expect(schemaOf('/skills')).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/Skill' },
    });
  });

  it('publie tous les composants nommés', () => {
    expect(Object.keys(document.components?.schemas ?? {}).sort()).toEqual([
      'CefrLevel',
      'Certification',
      'ContractType',
      'Cv',
      'Education',
      'Experience',
      'ExperienceKind',
      'HealthResponse',
      'Image',
      'IsoDate',
      'Language',
      'Locale',
      'ProblemDetails',
      'Profile',
      'Project',
      'Resource',
      'Skill',
      'SkillGroup',
      'Slug',
      'SocialLink',
      'Tool',
      'WorkMode',
    ]);
  });

  it('garde les champs nullable requis et les objets stricts (contrat pour le portage Rust)', () => {
    const schemas = document.components?.schemas ?? {};
    const experience = schemas['Experience'] as {
      required: string[];
      additionalProperties: boolean;
      properties: Record<string, unknown>;
    };
    expect(experience.required).toEqual(expect.arrayContaining(['company', 'dateEnd', 'logo']));
    expect(experience.additionalProperties).toBe(false);
    expect(experience.properties['dateEnd']).toEqual({
      anyOf: [{ $ref: '#/components/schemas/IsoDate' }, { type: 'null' }],
    });
    // Le composant partagé ne devient jamais nullable.
    expect(schemas['Image']).toMatchObject({ type: 'object' });
    expect(schemas['ContractType']).not.toHaveProperty('type', ['string', 'null']);
  });

  it('garde les champs à default en annotation : aucun champ de réponse ne devient optionnel', () => {
    for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
      const { properties = {}, required = [] } = schema as {
        properties?: Record<string, { default?: unknown }>;
        required?: string[];
      };
      for (const [key, property] of Object.entries(properties)) {
        if ('default' in property) {
          expect(required, `${name}.${key}`).toContain(key);
        }
      }
    }
  });
});
