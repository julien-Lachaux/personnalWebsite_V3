import { describe, expect, it } from 'vitest';

import { LanguageSchema } from './languages.js';

const valid = {
  slug: 'en',
  code: 'en',
  cefrLevel: 'C1',
  name: 'Anglais',
  levelLabel: 'professionnel',
};

describe('LanguageSchema', () => {
  it('accepte une langue avec niveau CECRL ou sans (langue maternelle)', () => {
    expect(LanguageSchema.safeParse(valid).success).toBe(true);
    expect(LanguageSchema.safeParse({ ...valid, cefrLevel: null }).success).toBe(true);
  });

  it('rejette un niveau CECRL inconnu', () => {
    expect(LanguageSchema.safeParse({ ...valid, cefrLevel: 'Z9' }).success).toBe(false);
  });

  it('rejette un code de langue mal formé', () => {
    expect(LanguageSchema.safeParse({ ...valid, code: 'EN' }).success).toBe(false);
  });
});
