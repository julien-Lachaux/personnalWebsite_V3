import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { LocaleQuerySchema, type SkillGroup, SkillGroupSchema } from '@siteperso/contracts';
import { z } from 'zod';

import { ListSkillGroupsUseCase } from '../../../application/skill-groups/list-skill-groups.use-case.js';

const SkillGroupsResponseSchema = z.array(SkillGroupSchema);

/** `GET /api/v1/skill-groups` : groupes publiés avec leurs compétences imbriquées. */
@Controller('skill-groups')
export class SkillGroupsController {
  constructor(private readonly listSkillGroups: ListSkillGroupsUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<SkillGroup[]> {
    const query = LocaleQuerySchema.safeParse(rawQuery);
    if (!query.success) {
      throw new BadRequestException('Paramètre « lang » invalide : valeurs acceptées fr, en.');
    }
    const groups = await this.listSkillGroups.execute(query.data.lang);
    // Validation stricte de la réponse avant envoi.
    return SkillGroupsResponseSchema.parse(groups);
  }
}
