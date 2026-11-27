import { describe, expect, it } from 'vitest';

import { ProfileSchema } from './profile.js';

// BF-16 (RS-1, revue sécurité F10, brief back-006) : `cvPath` reste un chemin statique du site,
// jamais une URL externe. Un antislash en 2e position (`/\hôte`) est résolu par le navigateur en
// `//hôte` (hôte externe) : il est refusé. La contrainte `/cv/%` en base (migration 0017) ne vaut
// que pour la base ; le contrat garde la règle générique de chemin statique.

const valid = {
  firstName: 'Prénom',
  lastName: 'Nom',
  location: 'Melun, Île-de-France',
  picture: { path: '/images/profile.webp', alt: 'Portrait de profil' },
  title: 'Développeur full-stack',
  titleBadge: 'senior',
  taglines: ['Accroche'],
  intro: 'Introduction.',
  mission: 'Mission.',
  currentActivity: 'Activité du moment.',
  seekingFormat: 'Temps partiel',
  seekingLocation: 'Paris',
  seekingAvailability: 'Immédiate',
  cvPath: '/cv/cv-fr.pdf',
};

describe('ProfileSchema.cvPath : refus des antislashs et des hôtes externes (BF-16)', () => {
  it('accepte /cv/cv-fr.pdf', () => {
    expect(ProfileSchema.safeParse({ ...valid, cvPath: '/cv/cv-fr.pdf' }).success).toBe(true);
  });

  it.each([
    ['antislash en 2e position puis hôte', '/\\h.example/x.pdf'],
    ['antislash en 2e position', '/\\cv.pdf'],
    ['double slash puis hôte', '//host/x.pdf'],
    ['double antislash puis hôte', '/\\\\host/x.pdf'],
    ['protocole javascript:', 'javascript:alert(1)'],
    ['URL absolue', 'https://host/x.pdf'],
  ])('refuse %s (%j)', (_label, cvPath) => {
    expect(ProfileSchema.safeParse({ ...valid, cvPath }).success).toBe(false);
  });

  // `/cv.pdf` reste valide au contrat : la restriction à `/cv/%` est une contrainte de base
  // (migration 0017), pas une règle du schéma Zod.
  it('accepte /cv.pdf au contrat (la contrainte /cv/% est côté base)', () => {
    expect(ProfileSchema.safeParse({ ...valid, cvPath: '/cv.pdf' }).success).toBe(true);
  });
});
