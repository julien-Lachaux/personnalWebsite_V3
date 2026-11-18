import { Controller, Get, Query } from '@nestjs/common';
import { type SocialLink, SocialLinkSchema } from '@siteperso/contracts';

import { ListSocialLinksUseCase } from '../../../application/social-links/list-social-links.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** `GET /api/v1/social-links` : liens publiés, triés par `sort_order`. */
@Controller('social-links')
export class SocialLinksController {
  constructor(private readonly listSocialLinks: ListSocialLinksUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<SocialLink[]> {
    const locale = parseLocaleQuery(rawQuery);
    // Validation stricte de la réponse avant envoi.
    return SocialLinkSchema.array().parse(await this.listSocialLinks.execute(locale));
  }
}
