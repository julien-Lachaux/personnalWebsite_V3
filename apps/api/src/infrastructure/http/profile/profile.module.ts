import { Module } from '@nestjs/common';

import { GetProfileUseCase } from '../../../application/profile/get-profile.use-case.js';
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
} from '../../../application/profile/ports/profile-repository.port.js';
import { DrizzleDatabaseClient } from '../../db/drizzle-database-client.js';
import { DrizzleProfileRepository } from '../../db/profile/drizzle-profile.repository.js';
import { ProfileController } from './profile.controller.js';

/** Module de la ressource « profil ». Exporte le cas d'usage pour le module `cv`. */
@Module({
  controllers: [ProfileController],
  providers: [
    {
      provide: PROFILE_REPOSITORY,
      useFactory: (client: DrizzleDatabaseClient) => new DrizzleProfileRepository(client),
      inject: [DrizzleDatabaseClient],
    },
    {
      provide: GetProfileUseCase,
      useFactory: (profiles: ProfileRepository) => new GetProfileUseCase(profiles),
      inject: [PROFILE_REPOSITORY],
    },
  ],
  exports: [GetProfileUseCase],
})
export class ProfileModule {}
