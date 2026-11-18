import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « langues » (`GET /api/v1/languages`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('languages')
export class LanguagesController {
  @Get()
  list(): never {
    throw new NotImplementedException('Ressource « languages » : implémentation prévue au lot 3.');
  }
}
