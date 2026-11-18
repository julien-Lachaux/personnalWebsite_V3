import { Module } from '@nestjs/common';

import { ResourcesController } from './resources.controller.js';

/** Module de la ressource « ressources ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [ResourcesController] })
export class ResourcesModule {}
