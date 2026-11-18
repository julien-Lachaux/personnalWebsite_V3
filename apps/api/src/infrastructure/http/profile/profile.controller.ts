import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « profil » (`GET /api/v1/profile`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('profile')
export class ProfileController {
  @Get()
  list(): never {
    throw new NotImplementedException('Ressource « profile » : implémentation prévue au lot 3.');
  }
}
