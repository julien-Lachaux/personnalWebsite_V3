import { describe, expect, it } from 'vitest';

import { isLocalizedErrorPage, LOCALIZED_ERROR_PAGES } from './error-pages.js';

describe('pages d’erreur statiques', () => {
  it('prérend en plus la page 404 anglaise (celle sans préfixe est écrite par Nuxt)', () => {
    expect(LOCALIZED_ERROR_PAGES).toEqual(['/en/404.html']);
  });

  it('reconnaît la page 404 anglaise et elle seule', () => {
    expect(isLocalizedErrorPage('/en/404.html')).toBe(true);
    expect(isLocalizedErrorPage('/404.html')).toBe(false);
    expect(isLocalizedErrorPage('/en/accessibility')).toBe(false);
    expect(isLocalizedErrorPage('/en/404')).toBe(false);
    expect(isLocalizedErrorPage('/fr/404.html')).toBe(false);
  });
});
