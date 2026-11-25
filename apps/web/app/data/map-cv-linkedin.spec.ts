import { describe, expect, it } from 'vitest';

import { cvFr } from './fixtures/cv.fr.js';
import { linkedinUrl } from './map-cv.js';

// URL du profil LinkedIn (lot 31, page « travaux en cours ») : le lien social de slug `linkedin`,
// jamais un autre lien de même nature ; absent, une erreur qui nomme le lien attendu.

describe('linkedinUrl', () => {
  it('rend l’URL du lien social de slug `linkedin`', () => {
    const socialLinks = [
      {
        slug: 'linkedin-recommendations',
        kind: 'linkedin',
        url: 'https://example.org/recommandations',
        label: 'Recommandations',
      },
      { slug: 'linkedin', kind: 'linkedin', url: 'https://example.org/profil', label: 'LinkedIn' },
    ] as const;

    expect(linkedinUrl({ socialLinks: [...socialLinks] })).toBe('https://example.org/profil');
    expect(linkedinUrl(cvFr)).toBe('https://www.linkedin.com/in/example');
  });

  it('lève une erreur explicite quand le lien manque', () => {
    const socialLinks = cvFr.socialLinks.filter((link) => link.slug !== 'linkedin');

    expect(() => linkedinUrl({ socialLinks })).toThrow(
      new Error(
        'Lien LinkedIn absent du CV : la page « travaux en cours » attend un lien social de slug « linkedin » (social_links).',
      ),
    );
    expect(() => linkedinUrl({ socialLinks: [] })).toThrow('Lien LinkedIn absent du CV');
  });
});
