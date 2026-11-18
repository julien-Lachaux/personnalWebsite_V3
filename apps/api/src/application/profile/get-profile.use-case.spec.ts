import { ProfileSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { EntityNotFoundError } from '../../domain/errors/entity-not-found.error.js';
import { type Profile } from '../../domain/profile/profile.js';
import { GetProfileUseCase } from './get-profile.use-case.js';
import { type ProfileRepository } from './ports/profile-repository.port.js';

const profile: Profile = {
  firstName: 'Prénom',
  lastName: 'Nom',
  location: 'Melun, Île-de-France',
  picturePath: '/images/profile/portrait.jpg',
  pictureAlt: 'Portrait',
  title: 'Développeur full-stack TypeScript senior',
  headline: 'Accroche',
  bio: 'Présentation',
  availability: 'Disponible pour des missions',
};

describe('GetProfileUseCase', () => {
  it("transmet la langue au dépôt et regroupe l'image en { path, alt }", async () => {
    const locales: string[] = [];
    const repository: ProfileRepository = {
      findProfile: (locale) => {
        locales.push(locale);
        return Promise.resolve(profile);
      },
    };

    const result = await new GetProfileUseCase(repository).execute('en');

    expect(locales).toEqual(['en']);
    expect(result.picture).toEqual({ path: '/images/profile/portrait.jpg', alt: 'Portrait' });
    expect(ProfileSchema.safeParse(result).success).toBe(true);
  });

  it('lève EntityNotFoundError quand le profil est absent', async () => {
    const repository: ProfileRepository = { findProfile: () => Promise.resolve(null) };

    await expect(new GetProfileUseCase(repository).execute('fr')).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );
  });
});
