import { Module } from '@nestjs/common';

import { ListExperiencesUseCase } from '../../../application/experiences/list-experiences.use-case.js';
import {
  EXPERIENCES_REPOSITORY,
  type ExperiencesRepository,
} from '../../../application/experiences/ports/experiences-repository.port.js';
import { DrizzleExperiencesRepository } from '../../db/experiences/drizzle-experiences.repository.js';
import { ExperiencesController } from './experiences.controller.js';

/** Module de la ressource « expériences ». Exporte le cas d'usage pour le module `cv`. */
@Module({
  controllers: [ExperiencesController],
  providers: [
    { provide: EXPERIENCES_REPOSITORY, useClass: DrizzleExperiencesRepository },
    {
      provide: ListExperiencesUseCase,
      useFactory: (experiences: ExperiencesRepository) => new ListExperiencesUseCase(experiences),
      inject: [EXPERIENCES_REPOSITORY],
    },
  ],
  exports: [ListExperiencesUseCase],
})
export class ExperiencesModule {}
