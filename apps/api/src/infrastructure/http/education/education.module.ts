import { Module } from '@nestjs/common';

import { EducationController } from './education.controller.js';

/** Module de la ressource « formation ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [EducationController] })
export class EducationModule {}
