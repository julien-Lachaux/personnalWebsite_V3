import { Module } from '@nestjs/common';

import { ListLanguagesUseCase } from '../../../application/languages/list-languages.use-case.js';
import {
  LANGUAGES_REPOSITORY,
  type LanguagesRepository,
} from '../../../application/languages/ports/languages-repository.port.js';
import { DrizzleLanguagesRepository } from '../../db/languages/drizzle-languages.repository.js';
import { LanguagesController } from './languages.controller.js';

/** Module de la ressource « langues ». Exporte le cas d'usage pour le module `cv`. */
@Module({
  controllers: [LanguagesController],
  providers: [
    { provide: LANGUAGES_REPOSITORY, useClass: DrizzleLanguagesRepository },
    {
      provide: ListLanguagesUseCase,
      useFactory: (languages: LanguagesRepository) => new ListLanguagesUseCase(languages),
      inject: [LANGUAGES_REPOSITORY],
    },
  ],
  exports: [ListLanguagesUseCase],
})
export class LanguagesModule {}
