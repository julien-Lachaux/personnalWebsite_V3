import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « compétences » (`GET /api/v1/skills`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('skills')
export class SkillsController {
  @Get()
  list(): never {
    throw new NotImplementedException('Ressource « skills » : implémentation prévue au lot 3.');
  }
}
