import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, LocaleQuerySchema, LocaleSchema } from './locale.js';

describe('LocaleSchema', () => {
  it('accepte fr et en', () => {
    expect(LocaleSchema.parse('fr')).toBe('fr');
    expect(LocaleSchema.parse('en')).toBe('en');
  });

  it('refuse toute autre valeur', () => {
    expect(LocaleSchema.safeParse('de').success).toBe(false);
    expect(LocaleSchema.safeParse('').success).toBe(false);
  });
});

describe('LocaleQuerySchema', () => {
  it('replie sur la locale par défaut quand lang est absent', () => {
    expect(LocaleQuerySchema.parse({})).toEqual({ lang: DEFAULT_LOCALE });
  });

  it('refuse une locale inconnue', () => {
    expect(LocaleQuerySchema.safeParse({ lang: 'de' }).success).toBe(false);
  });
});
