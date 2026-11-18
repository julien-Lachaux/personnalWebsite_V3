import { Module } from '@nestjs/common';

import { ListCertificationsUseCase } from '../../../application/certifications/list-certifications.use-case.js';
import {
  CERTIFICATIONS_REPOSITORY,
  type CertificationsRepository,
} from '../../../application/certifications/ports/certifications-repository.port.js';
import { DrizzleDatabaseClient } from '../../db/drizzle-database-client.js';
import { DrizzleCertificationsRepository } from '../../db/certifications/drizzle-certifications.repository.js';
import { CertificationsController } from './certifications.controller.js';

/** Module de la ressource « certifications » ; exporte son cas d'usage pour le module `cv`. */
@Module({
  controllers: [CertificationsController],
  providers: [
    {
      provide: CERTIFICATIONS_REPOSITORY,
      useFactory: (client: DrizzleDatabaseClient) => new DrizzleCertificationsRepository(client),
      inject: [DrizzleDatabaseClient],
    },
    {
      provide: ListCertificationsUseCase,
      useFactory: (repository: CertificationsRepository) =>
        new ListCertificationsUseCase(repository),
      inject: [CERTIFICATIONS_REPOSITORY],
    },
  ],
  exports: [ListCertificationsUseCase],
})
export class CertificationsModule {}
