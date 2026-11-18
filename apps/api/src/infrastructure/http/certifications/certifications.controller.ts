import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « certifications » (`GET /api/v1/certifications`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('certifications')
export class CertificationsController {
  @Get()
  list(): never {
    throw new NotImplementedException(
      'Ressource « certifications » : implémentation prévue au lot 3.',
    );
  }
}
