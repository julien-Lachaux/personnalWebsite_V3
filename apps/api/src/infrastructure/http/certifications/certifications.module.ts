import { Module } from '@nestjs/common';

import { CertificationsController } from './certifications.controller.js';

/** Module de la ressource « certifications ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [CertificationsController] })
export class CertificationsModule {}
