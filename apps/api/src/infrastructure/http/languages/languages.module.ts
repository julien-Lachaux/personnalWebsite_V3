import { Module } from '@nestjs/common';

import { LanguagesController } from './languages.controller.js';

/** Module de la ressource « langues ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [LanguagesController] })
export class LanguagesModule {}
