import { Module } from '@nestjs/common';

import { ListEducationUseCase } from '../../../application/education/list-education.use-case.js';
import {
  EDUCATION_REPOSITORY,
  type EducationRepository,
} from '../../../application/education/ports/education-repository.port.js';
import { DrizzleDatabaseClient } from '../../db/drizzle-database-client.js';
import { DrizzleEducationRepository } from '../../db/education/drizzle-education.repository.js';
import { EducationController } from './education.controller.js';

/** Module de la ressource « formation » ; exporte son cas d'usage pour le module `cv`. */
@Module({
  controllers: [EducationController],
  providers: [
    {
      provide: EDUCATION_REPOSITORY,
      useFactory: (client: DrizzleDatabaseClient) => new DrizzleEducationRepository(client),
      inject: [DrizzleDatabaseClient],
    },
    {
      provide: ListEducationUseCase,
      useFactory: (repository: EducationRepository) => new ListEducationUseCase(repository),
      inject: [EDUCATION_REPOSITORY],
    },
  ],
  exports: [ListEducationUseCase],
})
export class EducationModule {}
