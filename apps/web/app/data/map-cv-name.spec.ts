import { describe, expect, it } from 'vitest';

import { cvEn } from './fixtures/cv.en.js';
import { cvFr } from './fixtures/cv.fr.js';
import { mapCv, mapName } from './map-cv.js';

// Nom affiché du titulaire (lot F11, RC-5 de la revue F10) : il vient du contrat (`firstName`,
// `lastName`) et entre dans le modèle de vue, pour que la page n'ait plus à lire le contrat.

const labels = {
  present: 'P',
  breakOrganisation: 'B',
  workMode: (value: string) => `w:${value}`,
  contractType: (value: string) => `c:${value}`,
};

describe('mapName', () => {
  it('rend le prénom puis le nom, séparés d’une espace', () => {
    expect(mapName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
    expect(mapName(cvFr.profile)).toBe('Prénom Nom');
  });
});

describe('mapCv', () => {
  it('porte le nom du titulaire de la langue servie', () => {
    expect(mapCv(cvFr, labels).name).toBe('Prénom Nom');
    expect(
      mapCv({ ...cvEn, profile: { ...cvEn.profile, lastName: 'Lovelace' } }, labels).name,
    ).toBe(`${cvEn.profile.firstName} Lovelace`);
  });
});
