import { Module } from '@nestjs/common';

import { ListProjectsUseCase } from '../../../application/projects/list-projects.use-case.js';
import {
  PROJECTS_REPOSITORY,
  type ProjectsRepository,
} from '../../../application/projects/ports/projects-repository.port.js';
import { DrizzleDatabaseClient } from '../../db/drizzle-database-client.js';
import { DrizzleProjectsRepository } from '../../db/projects/drizzle-projects.repository.js';
import { ProjectsController } from './projects.controller.js';

/** Module de la ressource « projets » ; exporte son cas d'usage pour le module `cv`. */
@Module({
  controllers: [ProjectsController],
  providers: [
    {
      provide: PROJECTS_REPOSITORY,
      useFactory: (client: DrizzleDatabaseClient) => new DrizzleProjectsRepository(client),
      inject: [DrizzleDatabaseClient],
    },
    {
      provide: ListProjectsUseCase,
      useFactory: (repository: ProjectsRepository) => new ListProjectsUseCase(repository),
      inject: [PROJECTS_REPOSITORY],
    },
  ],
  exports: [ListProjectsUseCase],
})
export class ProjectsModule {}
