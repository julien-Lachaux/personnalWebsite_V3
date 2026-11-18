import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « groupes de compétences » (`GET /api/v1/skill-groups`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('skill-groups')
export class SkillGroupsController {
  @Get()
  list(): never {
    throw new NotImplementedException(
      'Ressource « skill-groups » : implémentation prévue au lot 3.',
    );
  }
}
