import { Module } from '@nestjs/common';

import { SocialLinksController } from './social-links.controller.js';

/** Module de la ressource « liens sociaux ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [SocialLinksController] })
export class SocialLinksModule {}
