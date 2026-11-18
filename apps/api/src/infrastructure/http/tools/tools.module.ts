import { Module } from '@nestjs/common';

import { ListToolsUseCase } from '../../../application/tools/list-tools.use-case.js';
import {
  TOOLS_REPOSITORY,
  type ToolsRepository,
} from '../../../application/tools/ports/tools-repository.port.js';
import { DrizzleDatabaseClient } from '../../db/drizzle-database-client.js';
import { DrizzleToolsRepository } from '../../db/tools/drizzle-tools.repository.js';
import { ToolsController } from './tools.controller.js';

/** Module de la ressource « outils » ; exporte son cas d'usage pour le module `cv`. */
@Module({
  controllers: [ToolsController],
  providers: [
    {
      provide: TOOLS_REPOSITORY,
      useFactory: (client: DrizzleDatabaseClient) => new DrizzleToolsRepository(client),
      inject: [DrizzleDatabaseClient],
    },
    {
      provide: ListToolsUseCase,
      useFactory: (repository: ToolsRepository) => new ListToolsUseCase(repository),
      inject: [TOOLS_REPOSITORY],
    },
  ],
  exports: [ListToolsUseCase],
})
export class ToolsModule {}
