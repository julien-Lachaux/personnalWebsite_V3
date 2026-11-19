import { describe, expect, it } from 'vitest';

import { EntityNotFoundError } from '../../domain/errors/entity-not-found.error.js';
import { GetProfileUseCase } from './get-profile.use-case.js';
import { type ProfileRepository } from './ports/profile-repository.port.js';

describe('GetProfileUseCase : profil absent', () => {
  it('nomme le profil dans l’erreur (détail du 404)', async () => {
    const repository: ProfileRepository = { findProfile: () => Promise.resolve(null) };

    const error = await new GetProfileUseCase(repository).execute('fr').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EntityNotFoundError);
    expect(error).toMatchObject({
      entity: 'Profil',
      identifier: 'profile',
      message: 'Profil « profile » introuvable.',
    });
  });
});
