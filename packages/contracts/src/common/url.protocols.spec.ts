import { describe, expect, it } from 'vitest';

import { HttpUrlSchema } from './url.js';

describe('HttpUrlSchema : le protocole doit être exactement http ou https', () => {
  it.each([
    'httpx://example.test',
    'https2://example.test',
    'httpss://example.test',
    'xhttp://example.test',
    'shttps://example.test',
    'view-source+http://example.test',
  ])('refuse le protocole voisin de %s', (url) => {
    expect(HttpUrlSchema.safeParse(url).success).toBe(false);
  });

  it.each(['HTTP://EXAMPLE.TEST', 'HTTPS://example.test/Chemin'])(
    'accepte la forme en majuscules %s (le protocole est normalisé)',
    (url) => {
      expect(HttpUrlSchema.safeParse(url).success).toBe(true);
    },
  );
});
