import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « projets » (`GET /api/v1/projects`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('projects')
export class ProjectsController {
  @Get()
  list(): never {
    throw new NotImplementedException('Ressource « projects » : implémentation prévue au lot 3.');
  }
}
