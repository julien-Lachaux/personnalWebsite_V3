import { describe, expect, it } from 'vitest';

import { parsePurgeArguments } from './deleted-purge-arguments.js';

describe('parsePurgeArguments', () => {
  it('lit --older-than <jours> sans confirmation par défaut (simulation)', () => {
    expect(parsePurgeArguments(['--older-than', '30'])).toEqual({
      olderThanDays: 30,
      confirm: false,
    });
  });

  it('lit la forme --older-than=<jours> et --confirm, dans n’importe quel ordre', () => {
    expect(parsePurgeArguments(['--confirm', '--older-than=7'])).toEqual({
      olderThanDays: 7,
      confirm: true,
    });
  });

  it('accepte 0 (toutes les entités marquées)', () => {
    expect(parsePurgeArguments(['--older-than', '0']).olderThanDays).toBe(0);
  });

  it('ignore le séparateur « -- » que pnpm peut transmettre', () => {
    expect(parsePurgeArguments(['--', '--older-than', '1', '--confirm'])).toEqual({
      olderThanDays: 1,
      confirm: true,
    });
  });

  it('exige --older-than', () => {
    expect(() => parsePurgeArguments([])).toThrow(/--older-than <jours> est obligatoire/);
    expect(() => parsePurgeArguments(['--confirm'])).toThrow(
      /--older-than <jours> est obligatoire/,
    );
  });

  it.each([[['--older-than']], [['--older-than', '--confirm']]])(
    'refuse --older-than sans valeur (%j)',
    (argv) => {
      expect(() => parsePurgeArguments(argv)).toThrow(/entier de jours/);
    },
  );

  it.each(['abc', '-3', '1.5', '', '1e3'])('refuse la valeur %j', (value) => {
    expect(() => parsePurgeArguments(['--older-than', value])).toThrow(/entier de jours/);
    expect(() => parsePurgeArguments([`--older-than=${value}`])).toThrow(/entier de jours/);
  });

  it('refuse un argument inconnu', () => {
    expect(() => parsePurgeArguments(['--older-than', '1', '--force'])).toThrow(
      'Argument inconnu : --force',
    );
  });
});
