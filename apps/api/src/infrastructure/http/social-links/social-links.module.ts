import { Module } from '@nestjs/common';

import { ListSocialLinksUseCase } from '../../../application/social-links/list-social-links.use-case.js';
import {
  SOCIAL_LINKS_REPOSITORY,
  type SocialLinksRepository,
} from '../../../application/social-links/ports/social-links-repository.port.js';
import { DrizzleDatabaseClient } from '../../db/drizzle-database-client.js';
import { DrizzleSocialLinksRepository } from '../../db/social-links/drizzle-social-links.repository.js';
import { SocialLinksController } from './social-links.controller.js';

/** Module de la ressource « liens sociaux ». Exporte le cas d'usage pour le module `cv`. */
@Module({
  controllers: [SocialLinksController],
  providers: [
    {
      provide: SOCIAL_LINKS_REPOSITORY,
      useFactory: (client: DrizzleDatabaseClient) => new DrizzleSocialLinksRepository(client),
      inject: [DrizzleDatabaseClient],
    },
    {
      provide: ListSocialLinksUseCase,
      useFactory: (socialLinks: SocialLinksRepository) => new ListSocialLinksUseCase(socialLinks),
      inject: [SOCIAL_LINKS_REPOSITORY],
    },
  ],
  exports: [ListSocialLinksUseCase],
})
export class SocialLinksModule {}
