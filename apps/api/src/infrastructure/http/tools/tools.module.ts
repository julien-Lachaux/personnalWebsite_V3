import { Module } from '@nestjs/common';

import { ToolsController } from './tools.controller.js';

/** Module de la ressource « outils ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [ToolsController] })
export class ToolsModule {}
