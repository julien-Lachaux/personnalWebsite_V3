import { describe, expect, it } from 'vitest';

import { hasEnglishCv } from './cv-link.js';

// D47 : la déclaration d'accessibilité ne parle d'un CV anglais que s'il est présent au build.
describe('hasEnglishCv (D47)', () => {
  it('vaut vrai seulement quand cv-en.pdf est dans la liste des CV présents', () => {
    expect(hasEnglishCv([])).toBe(false);
    expect(hasEnglishCv(['cv-fr.pdf'])).toBe(false);
    expect(hasEnglishCv(['cv-en.pdf'])).toBe(true);
    expect(hasEnglishCv(['cv-fr.pdf', 'cv-en.pdf'])).toBe(true);
  });
});
