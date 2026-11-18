import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { type Education, EducationSchema, LocaleQuerySchema } from '@siteperso/contracts';

import { ListEducationUseCase } from '../../../application/education/list-education.use-case.js';

/** Ressource « formation » : `GET /api/v1/education?lang=fr|en`. */
@Controller('education')
export class EducationController {
  constructor(private readonly listEducation: ListEducationUseCase) {}

  @Get()
  async list(@Query() query: unknown): Promise<Education[]> {
    const parsed = LocaleQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        'Paramètre « lang » invalide : valeurs permises « fr » ou « en ».',
      );
    }
    // Validation stricte de la réponse avant envoi : un écart avec le contrat donne un 500.
    return EducationSchema.array().parse(await this.listEducation.execute(parsed.data.lang));
  }
}
