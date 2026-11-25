import { describe, expect, it } from 'vitest';

import { CvSourceError } from './cv-source.js';
import { cvEn } from './fixtures/cv.en.js';
import { cvFr } from './fixtures/cv.fr.js';
import { parseCv } from './parse-cv.js';

/** Capture l'erreur levée par `parseCv`. */
function failure(data: unknown, locale: 'fr' | 'en' = 'fr'): CvSourceError {
  try {
    parseCv(data, locale, 'origine test');
  } catch (error) {
    if (error instanceof CvSourceError) return error;
    throw error;
  }
  throw new Error('parseCv aurait dû échouer');
}

describe('parseCv', () => {
  it('rend le CV validé, dans la langue demandée', () => {
    expect(parseCv(cvFr, 'fr', 'origine test')).toEqual(cvFr);
    expect(parseCv(cvEn, 'en', 'origine test').locale).toBe('en');
  });

  it('refuse une réponse hors contrat en nommant le chemin du champ fautif', () => {
    const broken = structuredClone(cvFr);
    broken.profile.taglines = [];

    const error = failure(broken);

    expect(error.kind).toBe('invalid');
    expect(error.message).toMatch(
      /^Réponse non conforme au contrat Cv \(origine test\) : profile\.taglines : /,
    );
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('nomme l’indice d’un élément de tableau fautif', () => {
    const broken = structuredClone(cvFr);
    broken.experiences = broken.experiences.map((experience, index) =>
      index === 1 ? { ...experience, dateStart: 'pas une date' } : experience,
    );

    expect(failure(broken).message).toContain(' : experiences.1.dateStart : ');
  });

  it('désigne la racine quand la réponse n’est pas un objet', () => {
    expect(failure(null).message).toContain(' : (racine) : ');
  });

  it('refuse une clé inconnue (contrat strict)', () => {
    expect(failure({ ...cvFr, extra: true }).message).toContain(' : (racine) : ');
  });

  it('ne cite que les cinq premiers champs fautifs, séparés par « ; »', () => {
    const broken = { ...structuredClone(cvFr), locale: 1, profile: 1, socialLinks: 1 };
    expect(failure(broken).message.split(' ; ')).toHaveLength(3);

    const many = Object.fromEntries(Object.keys(cvFr).map((key) => [key, 1]));
    expect(failure(many).message.split(' ; ')).toHaveLength(5);
  });

  it('refuse une langue différente de celle demandée', () => {
    const error = failure(cvEn, 'fr');

    expect(error.kind).toBe('invalid');
    expect(error.message).toBe('Langue inattendue (origine test) : « fr » demandée, « en » reçue');
  });
});
