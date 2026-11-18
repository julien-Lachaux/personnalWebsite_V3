import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { type Experience, ExperienceSchema, LocaleQuerySchema } from '@siteperso/contracts';
import { z } from 'zod';

import { ListExperiencesUseCase } from '../../../application/experiences/list-experiences.use-case.js';

const ExperiencesResponseSchema = z.array(ExperienceSchema);

/** `GET /api/v1/experiences` : expériences publiées, de la plus récente à la plus ancienne. */
@Controller('experiences')
export class ExperiencesController {
  constructor(private readonly listExperiences: ListExperiencesUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<Experience[]> {
    const query = LocaleQuerySchema.safeParse(rawQuery);
    if (!query.success) {
      throw new BadRequestException('Paramètre « lang » invalide : valeurs acceptées fr, en.');
    }
    const experiences = await this.listExperiences.execute(query.data.lang);
    // Validation stricte de la réponse avant envoi.
    return ExperiencesResponseSchema.parse(experiences);
  }
}
