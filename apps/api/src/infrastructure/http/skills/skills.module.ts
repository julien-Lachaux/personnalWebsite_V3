import { Module } from '@nestjs/common';

import { ListSkillsUseCase } from '../../../application/skills/list-skills.use-case.js';
import {
  SKILLS_REPOSITORY,
  type SkillsRepository,
} from '../../../application/skills/ports/skills-repository.port.js';
import { DrizzleSkillsRepository } from '../../db/skills/drizzle-skills.repository.js';
import { SkillsController } from './skills.controller.js';

/** Module de la ressource « compétences ». Exporte le cas d'usage pour le module `cv`. */
@Module({
  controllers: [SkillsController],
  providers: [
    { provide: SKILLS_REPOSITORY, useClass: DrizzleSkillsRepository },
    {
      provide: ListSkillsUseCase,
      useFactory: (skills: SkillsRepository) => new ListSkillsUseCase(skills),
      inject: [SKILLS_REPOSITORY],
    },
  ],
  exports: [ListSkillsUseCase],
})
export class SkillsModule {}
