import { describe, expect, it } from 'vitest';

import { inlineTitle } from './format.js';

// Intitulé de poste repris en cours de phrase (lot F11, RC-5 de la revue F10) : description de la page
// d'accueil construite depuis le CV, au même texte que l'ancien libellé figé.

describe('inlineTitle', () => {
  it('met l’initiale en minuscule et garde le reste tel quel', () => {
    expect(inlineTitle('Développeur full-stack')).toBe('développeur full-stack');
    expect(inlineTitle('Full-stack developer')).toBe('full-stack developer');
    expect(inlineTitle('Lead QA engineer')).toBe('lead QA engineer');
    expect(inlineTitle('Écrivain')).toBe('écrivain');
    expect(inlineTitle('É')).toBe('é');
  });

  it('garde tel quel un intitulé qui commence par un sigle', () => {
    expect(inlineTitle('CTO')).toBe('CTO');
    expect(inlineTitle('QA engineer')).toBe('QA engineer');
    expect(inlineTitle('ÉÉ')).toBe('ÉÉ');
  });

  it('laisse un intitulé déjà en minuscule, ou vide, inchangé', () => {
    expect(inlineTitle('développeur')).toBe('développeur');
    expect(inlineTitle('')).toBe('');
  });
});
