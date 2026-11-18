import { Module } from '@nestjs/common';

import { ProfileController } from './profile.controller.js';

/** Module de la ressource « profil ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [ProfileController] })
export class ProfileModule {}
