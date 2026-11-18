import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « formation » (`GET /api/v1/education`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('education')
export class EducationController {
  @Get()
  list(): never {
    throw new NotImplementedException('Ressource « education » : implémentation prévue au lot 3.');
  }
}
