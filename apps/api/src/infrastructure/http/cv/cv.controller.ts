import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { type Cv, CvSchema, LocaleQuerySchema } from '@siteperso/contracts';

import { GetCvUseCase } from '../../../application/cv/get-cv.use-case.js';

/** `GET /api/v1/cv` : CV agrégé en un appel, dans la langue demandée (repli `en` vers `fr`). */
@Controller('cv')
export class CvController {
  constructor(private readonly getCv: GetCvUseCase) {}

  @Get()
  async get(@Query() rawQuery: unknown): Promise<Cv> {
    const query = LocaleQuerySchema.safeParse(rawQuery);
    if (!query.success) {
      throw new BadRequestException('Paramètre « lang » invalide : valeurs acceptées fr, en.');
    }
    const cv = await this.getCv.execute(query.data.lang);
    // Validation stricte de la réponse avant envoi (déjà faite par le cas d'usage, redoublée par convention).
    return CvSchema.parse(cv);
  }
}
