import { Module } from '@nestjs/common';

import { ExperiencesController } from './experiences.controller.js';

/** Module de la ressource « expériences ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [ExperiencesController] })
export class ExperiencesModule {}
