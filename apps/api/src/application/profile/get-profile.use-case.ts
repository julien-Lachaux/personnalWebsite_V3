import { type Locale, type Profile as ProfileResponse } from '@siteperso/contracts';

import { EntityNotFoundError } from '../../domain/errors/entity-not-found.error.js';
import { type ProfileRepository } from './ports/profile-repository.port.js';

/** Cas d'usage : profil public. Classe pure, sans décorateur Nest. */
export class GetProfileUseCase {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(locale: Locale): Promise<ProfileResponse> {
    const profile = await this.profiles.findProfile(locale);
    if (profile === null) {
      throw new EntityNotFoundError('Profil', 'profile');
    }
    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      location: profile.location,
      picture: { path: profile.picturePath, alt: profile.pictureAlt },
      title: profile.title,
      headline: profile.headline,
      bio: profile.bio,
      availability: profile.availability,
    };
  }
}
