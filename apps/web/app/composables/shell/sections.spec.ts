import { describe, expect, it } from 'vitest';

import { TILE_ORDER } from '../../domain/layout.js';
import { SECTION_FILES, SECTION_IDS, SITE_HANDLE } from './sections.js';

describe('sections', () => {
  it('suivent l’ordre des tuiles : Profil, XP, Recos, IA', () => {
    expect(SECTION_IDS).toEqual(['profile', 'experience', 'recommendations', 'ai']);
    expect(SECTION_IDS).toEqual(TILE_ORDER);
  });

  it('affichent le fichier de la spécification (§ 2)', () => {
    expect(SECTION_FILES).toEqual({
      profile: 'profil.cv',
      experience: 'experience.log',
      recommendations: 'recommandations.md',
      ai: 'ia.md',
    });
    expect(Object.keys(SECTION_FILES)).toEqual([...SECTION_IDS]);
  });

  it('nomme le site dans les barres du haut', () => {
    expect(SITE_HANDLE).toBe('julien-lachaux');
  });
});
