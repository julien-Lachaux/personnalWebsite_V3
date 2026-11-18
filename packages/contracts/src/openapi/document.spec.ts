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
});
