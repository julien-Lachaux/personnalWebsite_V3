import { Controller, Get, Query } from '@nestjs/common';
import { type Experience, ExperienceSchema } from '@siteperso/contracts';

import { ListExperiencesUseCase } from '../../../application/experiences/list-experiences.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** `GET /api/v1/experiences` : expériences publiées, de la plus récente à la plus ancienne. */
@Controller('experiences')
export class ExperiencesController {
  constructor(private readonly listExperiences: ListExperiencesUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<Experience[]> {
    const locale = parseLocaleQuery(rawQuery);
    // Validation stricte de la réponse avant envoi.
    return ExperienceSchema.array().parse(await this.listExperiences.execute(locale));
  }
}
