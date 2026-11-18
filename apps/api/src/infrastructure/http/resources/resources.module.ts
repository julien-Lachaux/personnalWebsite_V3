import { Module } from '@nestjs/common';

import { ListResourcesUseCase } from '../../../application/resources/list-resources.use-case.js';
import {
  RESOURCES_REPOSITORY,
  type ResourcesRepository,
} from '../../../application/resources/ports/resources-repository.port.js';
import { DrizzleResourcesRepository } from '../../db/resources/drizzle-resources.repository.js';
import { ResourcesController } from './resources.controller.js';

/** Module de la ressource « ressources » ; exporte son cas d'usage pour le module `cv`. */
@Module({
  controllers: [ResourcesController],
  providers: [
    { provide: RESOURCES_REPOSITORY, useClass: DrizzleResourcesRepository },
    {
      provide: ListResourcesUseCase,
      useFactory: (repository: ResourcesRepository) => new ListResourcesUseCase(repository),
      inject: [RESOURCES_REPOSITORY],
    },
  ],
  exports: [ListResourcesUseCase],
})
export class ResourcesModule {}
