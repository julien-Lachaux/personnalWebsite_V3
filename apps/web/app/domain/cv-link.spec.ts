import { describe, expect, it } from 'vitest';

import { CV_DIRECTORY, CV_FALLBACK_LANGUAGE, cvFileName, resolveCvLink } from './cv-link.js';

describe('cvFileName', () => {
  it('nomme le CV d’une langue cv-<langue>.pdf, servi sous /cv/', () => {
    expect(cvFileName('fr')).toBe('cv-fr.pdf');
    expect(cvFileName('en')).toBe('cv-en.pdf');
    expect(CV_DIRECTORY).toBe('/cv/');
    expect(CV_FALLBACK_LANGUAGE).toBe('fr');
  });
});

describe('resolveCvLink', () => {
  it('mène au CV français, signalé, quand le CV anglais manque (comportement provisoire de D22)', () => {
    expect(resolveCvLink('/cv/cv-en.pdf', 'en', ['cv-fr.pdf'])).toEqual({
      href: '/cv/cv-fr.pdf',
      fallbackLanguage: 'fr',
    });
  });

  it('garde le CV de la langue dès qu’il est présent : le repli cesse sans changement de code', () => {
    expect(resolveCvLink('/cv/cv-en.pdf', 'en', ['cv-en.pdf', 'cv-fr.pdf'])).toEqual({
      href: '/cv/cv-en.pdf',
      fallbackLanguage: null,
    });
    expect(resolveCvLink('/cv/cv-en.pdf', 'en', ['cv-en.pdf'])).toEqual({
      href: '/cv/cv-en.pdf',
      fallbackLanguage: null,
    });
  });

  it('garde le CV français de la page française', () => {
    expect(resolveCvLink('/cv/cv-fr.pdf', 'fr', ['cv-fr.pdf'])).toEqual({
      href: '/cv/cv-fr.pdf',
      fallbackLanguage: null,
    });
  });

  it('ne se replie pas sans CV français : l’adresse reçue reste telle quelle', () => {
    expect(resolveCvLink('/cv/cv-en.pdf', 'en', [])).toEqual({
      href: '/cv/cv-en.pdf',
      fallbackLanguage: null,
    });
    expect(resolveCvLink('/cv/cv-en.pdf', 'en', ['cv-de.pdf'])).toEqual({
      href: '/cv/cv-en.pdf',
      fallbackLanguage: null,
    });
    expect(resolveCvLink('/cv/cv-fr.pdf', 'fr', [])).toEqual({
      href: '/cv/cv-fr.pdf',
      fallbackLanguage: null,
    });
  });

  it('ne remplace que le CV propre à la langue de la page', () => {
    // CV d'une autre langue que celle de la page.
    expect(resolveCvLink('/cv/cv-de.pdf', 'en', ['cv-fr.pdf'])).toEqual({
      href: '/cv/cv-de.pdf',
      fallbackLanguage: null,
    });
    // Autre fichier, même dossier.
    expect(resolveCvLink('/cv/exemple.pdf', 'en', ['cv-fr.pdf'])).toEqual({
      href: '/cv/exemple.pdf',
      fallbackLanguage: null,
    });
    // Même nom de fichier, ailleurs (autre dossier, autre site, adresse relative).
    for (const href of [
      '/docs/cv-en.pdf',
      'https://example.org/cv/cv-en.pdf',
      'cv/cv-en.pdf',
      'cv-en.pdf',
      '/cv/cv-en.pdf?v=2',
    ]) {
      expect(resolveCvLink(href, 'en', ['cv-fr.pdf']), href).toEqual({
        href,
        fallbackLanguage: null,
      });
    }
  });
});
