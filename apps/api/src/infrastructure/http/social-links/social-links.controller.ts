import { Controller, Get, NotImplementedException } from '@nestjs/common';

/**
 * Ressource « liens sociaux » (`GET /api/v1/social-links`). Squelette du lot 0 : la route répond 501
 * problem+json jusqu'à son implémentation au lot 3 (voir docs/01 pour le contrat).
 */
@Controller('social-links')
export class SocialLinksController {
  @Get()
  list(): never {
    throw new NotImplementedException(
      'Ressource « social-links » : implémentation prévue au lot 3.',
    );
  }
}
