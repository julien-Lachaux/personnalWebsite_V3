import { Controller, Get, Query } from '@nestjs/common';
import { type Education, EducationSchema } from '@siteperso/contracts';

import { ListEducationUseCase } from '../../../application/education/list-education.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** Ressource « formation » : `GET /api/v1/education?lang=fr|en`. */
@Controller('education')
export class EducationController {
  constructor(private readonly listEducation: ListEducationUseCase) {}

  @Get()
  async list(@Query() query: unknown): Promise<Education[]> {
    const locale = parseLocaleQuery(query);
    // Validation stricte de la réponse avant envoi : un écart avec le contrat donne un 500.
    return EducationSchema.array().parse(await this.listEducation.execute(locale));
  }
}
