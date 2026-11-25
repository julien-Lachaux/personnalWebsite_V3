import { describe, expect, it } from 'vitest';

import { CV_LANGUAGES, cvFileName, cvVersions } from './cv-link.js';

describe('cvFileName', () => {
  it('nomme le CV d’une langue cv-<langue>.pdf', () => {
    expect(cvFileName('fr')).toBe('cv-fr.pdf');
    expect(cvFileName('en')).toBe('cv-en.pdf');
  });
});

describe('cvVersions (D44)', () => {
  it('propose toujours le français puis l’anglais', () => {
    expect(CV_LANGUAGES).toEqual(['fr', 'en']);
    expect(cvVersions('/cv/cv-fr.pdf', []).map((version) => version.language)).toEqual([
      'fr',
      'en',
    ]);
  });

  it('mène chaque version à son fichier, dans le dossier de l’adresse reçue', () => {
    expect(cvVersions('/cv/cv-en.pdf', ['cv-fr.pdf', 'cv-en.pdf'])).toEqual([
      { language: 'fr', href: '/cv/cv-fr.pdf', available: true },
      { language: 'en', href: '/cv/cv-en.pdf', available: true },
    ]);
    expect(cvVersions('https://example.org/docs/cv-fr.pdf', ['cv-fr.pdf'])).toEqual([
      { language: 'fr', href: 'https://example.org/docs/cv-fr.pdf', available: true },
      { language: 'en', href: 'https://example.org/docs/cv-en.pdf', available: false },
    ]);
    expect(cvVersions('cv-fr.pdf', ['cv-en.pdf'])).toEqual([
      { language: 'fr', href: 'cv-fr.pdf', available: false },
      { language: 'en', href: 'cv-en.pdf', available: true },
    ]);
  });

  it('marque indisponible la version dont le fichier manque : elle reste proposée', () => {
    expect(cvVersions('/cv/cv-fr.pdf', ['cv-fr.pdf'])).toEqual([
      { language: 'fr', href: '/cv/cv-fr.pdf', available: true },
      { language: 'en', href: '/cv/cv-en.pdf', available: false },
    ]);
    expect(cvVersions('/cv/cv-fr.pdf', ['cv-en.pdf'])).toEqual([
      { language: 'fr', href: '/cv/cv-fr.pdf', available: false },
      { language: 'en', href: '/cv/cv-en.pdf', available: true },
    ]);
  });

  it('devient disponible dès que le fichier est déposé, sans changement de code', () => {
    expect(cvVersions('/cv/cv-fr.pdf', ['cv-fr.pdf', 'cv-de.pdf'])[1]?.available).toBe(false);
    expect(cvVersions('/cv/cv-fr.pdf', ['cv-fr.pdf', 'cv-en.pdf'])[1]?.available).toBe(true);
  });
});
