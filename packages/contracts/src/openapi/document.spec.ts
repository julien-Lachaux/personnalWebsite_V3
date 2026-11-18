import { describe, expect, it } from 'vitest';

import { createOpenApiDocument } from './document.js';

describe('createOpenApiDocument', () => {
  const document = createOpenApiDocument();

  it('produit un document OpenAPI 3.1', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(document.info.title).toContain('API');
    expect(document.servers?.[0]?.url).toBe('/api/v1');
  });

  it('décrit GET /health avec sa réponse 200', () => {
    const operation = document.paths?.['/health']?.get;
    expect(operation?.operationId).toBe('getHealth');
    expect(operation?.responses?.['200']).toBeDefined();
  });

  it('expose les schémas nommés dans components', () => {
    const schemas = document.components?.schemas ?? {};
    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining(['ProblemDetails', 'HealthResponse']),
    );
  });

  it('est sérialisable en JSON sans perte', () => {
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });
});
