import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « outils » (`GET /api/v1/tools`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('tools')
export class ToolsController {
  @Get()
  list(): never {
    throw new NotImplementedException('Ressource « tools » : implémentation prévue au lot 3.');
  }
}
