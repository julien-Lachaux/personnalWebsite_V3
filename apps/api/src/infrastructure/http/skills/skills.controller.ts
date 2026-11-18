import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { LocaleQuerySchema, type Skill, SkillSchema } from '@siteperso/contracts';
import { z } from 'zod';

import { ListSkillsUseCase } from '../../../application/skills/list-skills.use-case.js';

const SkillsResponseSchema = z.array(SkillSchema);

/** `GET /api/v1/skills` : compétences publiées à plat, avec `groupSlug`. */
@Controller('skills')
export class SkillsController {
  constructor(private readonly listSkills: ListSkillsUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<Skill[]> {
    const query = LocaleQuerySchema.safeParse(rawQuery);
    if (!query.success) {
      throw new BadRequestException('Paramètre « lang » invalide : valeurs acceptées fr, en.');
    }
    const skills = await this.listSkills.execute(query.data.lang);
    // Validation stricte de la réponse avant envoi.
    return SkillsResponseSchema.parse(skills);
  }
}
