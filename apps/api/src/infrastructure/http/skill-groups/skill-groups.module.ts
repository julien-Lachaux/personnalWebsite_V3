import { Module } from '@nestjs/common';

import { ListSkillGroupsUseCase } from '../../../application/skill-groups/list-skill-groups.use-case.js';
import {
  SKILL_GROUPS_REPOSITORY,
  type SkillGroupsRepository,
} from '../../../application/skill-groups/ports/skill-groups-repository.port.js';
import { DrizzleDatabaseClient } from '../../db/drizzle-database-client.js';
import { DrizzleSkillGroupsRepository } from '../../db/skill-groups/drizzle-skill-groups.repository.js';
import { SkillGroupsController } from './skill-groups.controller.js';

/** Module de la ressource « groupes de compétences ». Exporte le cas d'usage pour `cv`. */
@Module({
  controllers: [SkillGroupsController],
  providers: [
    {
      provide: SKILL_GROUPS_REPOSITORY,
      useFactory: (client: DrizzleDatabaseClient) => new DrizzleSkillGroupsRepository(client),
      inject: [DrizzleDatabaseClient],
    },
    {
      provide: ListSkillGroupsUseCase,
      useFactory: (skillGroups: SkillGroupsRepository) => new ListSkillGroupsUseCase(skillGroups),
      inject: [SKILL_GROUPS_REPOSITORY],
    },
  ],
  exports: [ListSkillGroupsUseCase],
})
export class SkillGroupsModule {}
