import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { LocaleQuerySchema } from './locale.js';
import { PROBLEM_JSON_CONTENT_TYPE } from './problem-details.js';

describe('identifiants publics des contrats', () => {
  it('le type de média des erreurs est celui de la RFC 9457', () => {
    expect(PROBLEM_JSON_CONTENT_TYPE).toBe('application/problem+json');
  });

  it('LocaleQuery est exporté en JSON Schema sous son nom de composant', () => {
    const jsonSchema = z.toJSONSchema(LocaleQuerySchema);

    expect(jsonSchema.$ref).toBe('#/$defs/LocaleQuery');
    expect(Object.keys(jsonSchema.$defs ?? {}).sort()).toEqual(['Locale', 'LocaleQuery']);
  });
});
