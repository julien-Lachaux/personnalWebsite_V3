import { Module } from '@nestjs/common';

import { SkillGroupsController } from './skill-groups.controller.js';

/** Module de la ressource « groupes de compétences ». Seul l'agent chargé de cette ressource le modifie. */
@Module({ controllers: [SkillGroupsController] })
export class SkillGroupsModule {}
