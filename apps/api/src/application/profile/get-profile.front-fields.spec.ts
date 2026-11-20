import { ProfileSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Profile } from '../../domain/profile/profile.js';
import { GetProfileUseCase } from './get-profile.use-case.js';
import { type ProfileRepository } from './ports/profile-repository.port.js';

/** Profil fictif, une valeur distincte par champ pour détecter toute inversion. */
const profile: Profile = {
  firstName: 'Prénom',
  lastName: 'Nom',
  location: 'Ville',
  picturePath: '/images/profile/portrait.jpg',
  pictureAlt: 'Portrait',
  title: 'Titre',
  titleBadge: 'Pastille',
  taglines: ['Accroche 1', 'Accroche 2'],
  intro: 'Introduction',
  mission: 'Mission',
  currentActivity: 'En ce moment',
  seekingFormat: 'Format',
  seekingLocation: 'Lieu',
  seekingAvailability: 'Disponibilité',
  cvPath: '/cv/cv-en.pdf',
};

describe('GetProfileUseCase : champs du design v6 (BF-1)', () => {
  const repository: ProfileRepository = { findProfile: () => Promise.resolve(profile) };

  it('reporte chaque champ du dépôt à sa place dans le contrat', async () => {
    const result = await new GetProfileUseCase(repository).execute('fr');

    expect(ProfileSchema.parse(result)).toStrictEqual({
      firstName: 'Prénom',
      lastName: 'Nom',
      location: 'Ville',
      picture: { path: '/images/profile/portrait.jpg', alt: 'Portrait' },
      title: 'Titre',
      titleBadge: 'Pastille',
      taglines: ['Accroche 1', 'Accroche 2'],
      intro: 'Introduction',
      mission: 'Mission',
      currentActivity: 'En ce moment',
      seekingFormat: 'Format',
      seekingLocation: 'Lieu',
      seekingAvailability: 'Disponibilité',
      cvPath: '/cv/cv-en.pdf',
    });
  });

  it('renvoie une copie des accroches, jamais le tableau du dépôt', async () => {
    const result = await new GetProfileUseCase(repository).execute('fr');

    expect(result.taglines).not.toBe(profile.taglines);
    expect(result.taglines).toEqual(profile.taglines);
  });
});
