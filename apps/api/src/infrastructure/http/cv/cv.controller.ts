import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « CV agrégé » (`GET /api/v1/cv`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('cv')
export class CvController {
  @Get()
  list(): never {
    throw new NotImplementedException('Ressource « cv » : implémentation prévue au lot 3.');
  }
}
