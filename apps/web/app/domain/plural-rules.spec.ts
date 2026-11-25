import { describe, expect, it } from 'vitest';

import { frenchPlural } from './plural-rules.js';

// Règle de pluriel du français (RC-6) : zéro et un sont au singulier ; au-delà, pluriel. Les messages à
// deux formes (« une | plusieurs ») sont seuls concernés ; les autres suivent la règle par défaut.

const fallback = (choice: number, choicesLength: number): number =>
  100 + choice * 10 + choicesLength;

describe('frenchPlural', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1],
    [12, 1],
  ])('deux formes, %i : forme %i', (choice, expected) => {
    expect(frenchPlural(choice, 2, fallback)).toBe(expected);
  });

  it('un nombre négatif suit sa valeur absolue', () => {
    expect(frenchPlural(-1, 2, fallback)).toBe(0);
    expect(frenchPlural(-2, 2, fallback)).toBe(1);
  });

  it('confie à la règle par défaut les messages qui n’ont pas deux formes', () => {
    expect(frenchPlural(5, 3, fallback)).toBe(100 + 50 + 3);
    expect(frenchPlural(5, 1, fallback)).toBe(100 + 50 + 1);
  });
});
