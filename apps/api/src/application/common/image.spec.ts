import { describe, expect, it } from 'vitest';

import { toImage } from './image.js';

describe('toImage', () => {
  it('regroupe un chemin et un texte alternatif en image', () => {
    expect(toImage('/images/a.webp', 'Texte')).toEqual({ path: '/images/a.webp', alt: 'Texte' });
  });

  it.each([
    [null, 'Texte'],
    ['/images/a.webp', null],
    [null, null],
    ['', 'Texte'],
    ['/images/a.webp', ''],
    ['', ''],
  ])('renvoie null pour path=%j alt=%j', (path, alt) => {
    expect(toImage(path, alt)).toBeNull();
  });
});
