import { Controller, Get, Query } from '@nestjs/common';
import { type Cv, CvSchema } from '@siteperso/contracts';

import { GetCvUseCase } from '../../../application/cv/get-cv.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** `GET /api/v1/cv` : CV agrégé en un appel, dans la langue demandée (repli `en` vers `fr`). */
@Controller('cv')
export class CvController {
  constructor(private readonly getCv: GetCvUseCase) {}

  @Get()
  async get(@Query() rawQuery: unknown): Promise<Cv> {
    const locale = parseLocaleQuery(rawQuery);
    const cv = await this.getCv.execute(locale);
    // Validation stricte de la réponse avant envoi (faite ici seulement, pas dans le cas d'usage).
    return CvSchema.parse(cv);
  }
}
