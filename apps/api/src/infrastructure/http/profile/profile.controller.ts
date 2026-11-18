import { Controller, Get, Query } from '@nestjs/common';
import { type Profile, ProfileSchema } from '@siteperso/contracts';

import { GetProfileUseCase } from '../../../application/profile/get-profile.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** `GET /api/v1/profile` : profil public, 404 problem+json si la ligne n'existe pas. */
@Controller('profile')
export class ProfileController {
  constructor(private readonly getProfile: GetProfileUseCase) {}

  @Get()
  async get(@Query() rawQuery: unknown): Promise<Profile> {
    const locale = parseLocaleQuery(rawQuery);
    const profile = await this.getProfile.execute(locale);
    // Validation stricte de la réponse : une clé inattendue ou manquante donne un 500, pas une fuite.
    return ProfileSchema.parse(profile);
  }
}
