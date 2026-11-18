import { describe, expect, it } from 'vitest';

import { ProfileSchema } from './profile.js';

const valid = {
  firstName: 'Prénom',
  lastName: 'Nom',
  location: 'Melun, Île-de-France',
  picture: { path: '/images/profile.webp', alt: 'Portrait de profil' },
  title: 'Développeur full-stack TypeScript senior',
  headline: 'Accroche',
  bio: 'Présentation.',
  availability: 'Disponible pour des missions',
};

describe('ProfileSchema', () => {
  it('accepte un profil valide', () => {
    expect(ProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse toute clé inconnue, notamment une donnée de contact', () => {
    expect(ProfileSchema.safeParse({ ...valid, email: 'contact@example.com' }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...valid, phone: '+33 0 00 00 00 00' }).success).toBe(false);
  });

  it('exige une photo avec son texte alternatif', () => {
    expect(ProfileSchema.safeParse({ ...valid, picture: { path: '/a' } }).success).toBe(false);
  });
});
