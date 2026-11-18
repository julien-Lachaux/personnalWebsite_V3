import { Controller, Get, Query } from '@nestjs/common';
import { type SkillGroup, SkillGroupSchema } from '@siteperso/contracts';

import { ListSkillGroupsUseCase } from '../../../application/skill-groups/list-skill-groups.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** `GET /api/v1/skill-groups` : groupes publiés avec leurs compétences imbriquées. */
@Controller('skill-groups')
export class SkillGroupsController {
  constructor(private readonly listSkillGroups: ListSkillGroupsUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<SkillGroup[]> {
    const locale = parseLocaleQuery(rawQuery);
    // Validation stricte de la réponse avant envoi.
    return SkillGroupSchema.array().parse(await this.listSkillGroups.execute(locale));
  }
}
