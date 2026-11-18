import { Controller, Get, Query } from '@nestjs/common';
import { type Skill, SkillSchema } from '@siteperso/contracts';

import { ListSkillsUseCase } from '../../../application/skills/list-skills.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** `GET /api/v1/skills` : compétences publiées à plat, avec `groupSlug`. */
@Controller('skills')
export class SkillsController {
  constructor(private readonly listSkills: ListSkillsUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<Skill[]> {
    const locale = parseLocaleQuery(rawQuery);
    // Validation stricte de la réponse avant envoi.
    return SkillSchema.array().parse(await this.listSkills.execute(locale));
  }
}
