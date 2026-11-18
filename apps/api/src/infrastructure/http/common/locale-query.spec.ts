import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { parseLocaleQuery } from './locale-query.js';

describe('parseLocaleQuery', () => {
  it('renvoie fr par défaut', () => {
    expect(parseLocaleQuery({})).toBe('fr');
  });

  it.each(['fr', 'en'] as const)('lit lang=%s', (lang) => {
    expect(parseLocaleQuery({ lang })).toBe(lang);
  });

  it.each(['de', 'EN', '', ['fr', 'en'], 1, null])('refuse lang=%j', (lang) => {
    expect(() => parseLocaleQuery({ lang })).toThrow(BadRequestException);
    expect(() => parseLocaleQuery({ lang })).toThrow(
      'Paramètre « lang » invalide : valeurs acceptées fr, en.',
    );
  });
});
