import { describe, expect, it } from 'vitest';

import { ProfileSchema } from './profile.js';

/** Profil valide du design v6 (BF-1) : contenu fictif. */
const valid = {
  firstName: 'Prénom',
  lastName: 'Nom',
  location: 'Melun',
  picture: { path: '/images/profile.webp', alt: 'Portrait de profil' },
  title: 'Développeur full-stack',
  titleBadge: 'senior',
  taglines: ['Première accroche', 'Seconde accroche'],
  intro: 'Introduction.',
  mission: 'Mission.',
  currentActivity: 'Activité du moment.',
  seekingFormat: 'Temps partiel',
  seekingLocation: 'Paris · hybride',
  seekingAvailability: 'Immédiate',
  cvPath: '/cv/cv-fr.pdf',
};

type Key = keyof typeof valid;

const TEXT_FIELDS = [
  'title',
  'titleBadge',
  'intro',
  'mission',
  'currentActivity',
  'seekingFormat',
  'seekingLocation',
  'seekingAvailability',
] as const satisfies readonly Key[];

function without(key: Key): Partial<typeof valid> {
  const copy: Partial<typeof valid> = { ...valid };
  delete copy[key];
  return copy;
}

describe('ProfileSchema : champs du design v6 (BF-1)', () => {
  it('accepte un profil complet et le renvoie tel quel', () => {
    expect(ProfileSchema.parse(valid)).toEqual(valid);
  });

  it.each<Key>([...TEXT_FIELDS, 'taglines', 'cvPath'])('exige %s', (key) => {
    expect(ProfileSchema.safeParse(without(key)).success).toBe(false);
  });

  it.each(TEXT_FIELDS)('refuse %s vide', (key) => {
    expect(ProfileSchema.safeParse({ ...valid, [key]: '' }).success).toBe(false);
  });

  it('exige au moins une accroche, aucune vide', () => {
    expect(ProfileSchema.safeParse({ ...valid, taglines: [] }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...valid, taglines: ['Accroche', ''] }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...valid, taglines: 'Accroche' }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...valid, taglines: ['Une seule'] }).success).toBe(true);
  });

  it.each(['headline', 'bio', 'availability'])('refuse l’ancien champ %s', (key) => {
    expect(ProfileSchema.safeParse({ ...valid, [key]: 'Texte' }).success).toBe(false);
  });
});

describe('ProfileSchema.cvPath : chemin relatif à la racine du site', () => {
  it.each(['/cv/cv-fr.pdf', '/cv/cv-en.pdf', '/a', '/cv.pdf'])('accepte %s', (cvPath) => {
    expect(ProfileSchema.safeParse({ ...valid, cvPath }).success).toBe(true);
  });

  it.each([
    ['vide', ''],
    ['racine seule', '/'],
    ['sans / initial', 'cv/cv-fr.pdf'],
    ['protocole javascript:', 'javascript:alert(1)'],
    ['URL absolue', 'https://example.test/cv.pdf'],
    ['URL sans protocole', '//example.test/cv.pdf'],
    ['espace après le /', '/ cv.pdf'],
    ['espace au milieu', '/cv/cv fr.pdf'],
    ['espace final', '/cv/cv-fr.pdf '],
    ['retour à la ligne final', '/cv/cv-fr.pdf\n'],
    ['préfixe avant le /', 'x/cv.pdf'],
  ])('refuse %s (%j)', (_label, cvPath) => {
    expect(ProfileSchema.safeParse({ ...valid, cvPath }).success).toBe(false);
  });
});
