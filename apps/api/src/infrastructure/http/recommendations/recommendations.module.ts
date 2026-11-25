import { Module } from '@nestjs/common';

import { ListRecommendationsUseCase } from '../../../application/recommendations/list-recommendations.use-case.js';
import {
  RECOMMENDATIONS_REPOSITORY,
  type RecommendationsRepository,
} from '../../../application/recommendations/ports/recommendations-repository.port.js';
import { DrizzleDatabaseClient } from '../../db/drizzle-database-client.js';
import { DrizzleRecommendationsRepository } from '../../db/recommendations/drizzle-recommendations.repository.js';
import { RecommendationsController } from './recommendations.controller.js';

/** Module de la ressource « recommandations » (BF-4). Exporte le cas d'usage pour le module `cv`. */
@Module({
  controllers: [RecommendationsController],
  providers: [
    {
      provide: RECOMMENDATIONS_REPOSITORY,
      useFactory: (client: DrizzleDatabaseClient) => new DrizzleRecommendationsRepository(client),
      inject: [DrizzleDatabaseClient],
    },
    {
      provide: ListRecommendationsUseCase,
      useFactory: (recommendations: RecommendationsRepository) =>
        new ListRecommendationsUseCase(recommendations),
      inject: [RECOMMENDATIONS_REPOSITORY],
    },
  ],
  exports: [ListRecommendationsUseCase],
})
export class RecommendationsModule {}
