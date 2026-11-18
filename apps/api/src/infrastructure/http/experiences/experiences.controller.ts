import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « expériences » (`GET /api/v1/experiences`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('experiences')
export class ExperiencesController {
  @Get()
  list(): never {
    throw new NotImplementedException(
      'Ressource « experiences » : implémentation prévue au lot 3.',
    );
  }
}
