import { Module } from '@nestjs/common';

import { ListEducationUseCase } from '../../../application/education/list-education.use-case.js';
import {
  EDUCATION_REPOSITORY,
  type EducationRepository,
} from '../../../application/education/ports/education-repository.port.js';
import { DrizzleEducationRepository } from '../../db/education/drizzle-education.repository.js';
import { EducationController } from './education.controller.js';

/** Module de la ressource « formation » ; exporte son cas d'usage pour le module `cv`. */
@Module({
  controllers: [EducationController],
  providers: [
    { provide: EDUCATION_REPOSITORY, useClass: DrizzleEducationRepository },
    {
      provide: ListEducationUseCase,
      useFactory: (repository: EducationRepository) => new ListEducationUseCase(repository),
      inject: [EDUCATION_REPOSITORY],
    },
  ],
  exports: [ListEducationUseCase],
})
export class EducationModule {}
