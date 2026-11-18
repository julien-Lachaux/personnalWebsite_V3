import { Module } from '@nestjs/common';

import { ListToolsUseCase } from '../../../application/tools/list-tools.use-case.js';
import {
  TOOLS_REPOSITORY,
  type ToolsRepository,
} from '../../../application/tools/ports/tools-repository.port.js';
import { DrizzleToolsRepository } from '../../db/tools/drizzle-tools.repository.js';
import { ToolsController } from './tools.controller.js';

/** Module de la ressource « outils » ; exporte son cas d'usage pour le module `cv`. */
@Module({
  controllers: [ToolsController],
  providers: [
    { provide: TOOLS_REPOSITORY, useClass: DrizzleToolsRepository },
    {
      provide: ListToolsUseCase,
      useFactory: (repository: ToolsRepository) => new ListToolsUseCase(repository),
      inject: [TOOLS_REPOSITORY],
    },
  ],
  exports: [ListToolsUseCase],
})
export class ToolsModule {}
