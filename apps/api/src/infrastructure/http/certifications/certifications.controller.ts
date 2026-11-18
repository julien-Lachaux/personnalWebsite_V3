import { Controller, Get, Query } from '@nestjs/common';
import { type Certification, CertificationSchema } from '@siteperso/contracts';

import { ListCertificationsUseCase } from '../../../application/certifications/list-certifications.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** Ressource « certifications » : `GET /api/v1/certifications?lang=fr|en`. */
@Controller('certifications')
export class CertificationsController {
  constructor(private readonly listCertifications: ListCertificationsUseCase) {}

  @Get()
  async list(@Query() query: unknown): Promise<Certification[]> {
    const locale = parseLocaleQuery(query);
    // Validation stricte de la réponse avant envoi : un écart avec le contrat donne un 500.
    return CertificationSchema.array().parse(await this.listCertifications.execute(locale));
  }
}
