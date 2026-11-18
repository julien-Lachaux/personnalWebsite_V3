import { Module } from '@nestjs/common';

import { SkillsController } from './skills.controller.js';

/** Module de la ressource « compétences ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [SkillsController] })
export class SkillsModule {}
