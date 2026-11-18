import { describe, expect, it } from 'vitest';

import { CvSchema } from './cv.js';
import { cvExample } from './cv.fixtures.js';

describe('CvSchema', () => {
  it('accepte un exemple complet', () => {
    expect(CvSchema.safeParse(cvExample).success).toBe(true);
  });

  it('rejette l’absence de languages', () => {
    const { languages: _omitted, ...withoutLanguages } = cvExample;
    expect(CvSchema.safeParse(withoutLanguages).success).toBe(false);
  });

  it('rejette une clé supplémentaire (par exemple skills à plat)', () => {
    expect(CvSchema.safeParse({ ...cvExample, skills: [] }).success).toBe(false);
  });

  it('valide en profondeur les sous-schémas', () => {
    const broken = { ...cvExample, education: [{ ...cvExample.education[0], yearEnd: 1900 }] };
    expect(CvSchema.safeParse(broken).success).toBe(false);
    expect(CvSchema.safeParse({ ...cvExample, locale: 'de' }).success).toBe(false);
  });
});
