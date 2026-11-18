import { Module } from '@nestjs/common';

import { ProjectsController } from './projects.controller.js';

/** Module de la ressource « projets ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [ProjectsController] })
export class ProjectsModule {}
