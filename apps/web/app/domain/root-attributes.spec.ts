import { describe, expect, it } from 'vitest';

import { defaultPreferences, type Preferences } from './preferences.js';
import { ROOT_ATTRIBUTE_TABLE, rootAttributes } from './root-attributes.js';

// Table de l'interface préférences → CSS (tête de tokens.css), partagée par le montage et le script
// de thème : valeurs attendues écrites en clair.

const ALL_ON: Preferences = {
  theme: 'clair',
  textSize: 115,
  highContrast: true,
  readableFont: true,
  textSpacing: true,
  underlineLinks: true,
  reduceMotion: true,
};

describe('rootAttributes', () => {
  it('pose thème, taille et animations, retire les interrupteurs éteints', () => {
    expect(
      rootAttributes(defaultPreferences({ prefersDark: true, prefersReducedMotion: false })),
    ).toEqual({
      'data-theme': 'sombre',
      'data-contrast': null,
      'data-text-size': '100',
      'data-font': null,
      'data-spacing': null,
      'data-links': null,
      'data-motion': 'normal',
    });
  });

  it('écrit la valeur de chaque interrupteur allumé', () => {
    expect(rootAttributes(ALL_ON)).toEqual({
      'data-theme': 'clair',
      'data-contrast': 'renforce',
      'data-text-size': '115',
      'data-font': 'lisible',
      'data-spacing': 'augmente',
      'data-links': 'soulignes',
      'data-motion': 'reduit',
    });
  });

  it('décrit les sept attributs, chacun une fois, dans l’ordre de la table', () => {
    expect(ROOT_ATTRIBUTE_TABLE.map((row) => row.attribute)).toEqual([
      'data-theme',
      'data-contrast',
      'data-text-size',
      'data-font',
      'data-spacing',
      'data-links',
      'data-motion',
    ]);
    expect(Object.keys(rootAttributes(ALL_ON))).toHaveLength(7);
  });
});
