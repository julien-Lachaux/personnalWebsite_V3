import { Module } from '@nestjs/common';

import { CvController } from './cv.controller.js';

/** Module de la ressource « CV agrégé ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [CvController] })
export class CvModule {}
