import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « ressources » (`GET /api/v1/resources`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('resources')
export class ResourcesController {
  @Get()
  list(): never {
    throw new NotImplementedException('Ressource « resources » : implémentation prévue au lot 3.');
  }
}
