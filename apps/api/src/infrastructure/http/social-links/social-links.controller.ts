import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { LocaleQuerySchema, type SocialLink, SocialLinkSchema } from '@siteperso/contracts';
import { z } from 'zod';

import { ListSocialLinksUseCase } from '../../../application/social-links/list-social-links.use-case.js';

const SocialLinksResponseSchema = z.array(SocialLinkSchema);

/** `GET /api/v1/social-links` : liens publiés, triés par `sort_order`. */
@Controller('social-links')
export class SocialLinksController {
  constructor(private readonly listSocialLinks: ListSocialLinksUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<SocialLink[]> {
    const query = LocaleQuerySchema.safeParse(rawQuery);
    if (!query.success) {
      throw new BadRequestException('Paramètre « lang » invalide : valeurs acceptées fr, en.');
    }
    const links = await this.listSocialLinks.execute(query.data.lang);
    // Validation stricte de la réponse avant envoi.
    return SocialLinksResponseSchema.parse(links);
  }
}
