import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { type Certification, CertificationSchema, LocaleQuerySchema } from '@siteperso/contracts';

import { ListCertificationsUseCase } from '../../../application/certifications/list-certifications.use-case.js';

/** Ressource « certifications » : `GET /api/v1/certifications?lang=fr|en`. */
@Controller('certifications')
export class CertificationsController {
  constructor(private readonly listCertifications: ListCertificationsUseCase) {}

  @Get()
  async list(@Query() query: unknown): Promise<Certification[]> {
    const parsed = LocaleQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        'Paramètre « lang » invalide : valeurs permises « fr » ou « en ».',
      );
    }
    // Validation stricte de la réponse avant envoi : un écart avec le contrat donne un 500.
    return CertificationSchema.array().parse(
      await this.listCertifications.execute(parsed.data.lang),
    );
  }
}
