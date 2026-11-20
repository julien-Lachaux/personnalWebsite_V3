import { Module } from '@nestjs/common';

import { FindAiOverviewUseCase } from '../../../application/ai-overview/find-ai-overview.use-case.js';
import { GetAiOverviewUseCase } from '../../../application/ai-overview/get-ai-overview.use-case.js';
import {
  AI_OVERVIEW_REPOSITORY,
  type AiOverviewRepository,
} from '../../../application/ai-overview/ports/ai-overview-repository.port.js';
import { DrizzleAiOverviewRepository } from '../../db/ai-overview/drizzle-ai-overview.repository.js';
import { DrizzleDatabaseClient } from '../../db/drizzle-database-client.js';
import { AiOverviewController } from './ai-overview.controller.js';

/**
 * Module de la ressource « section IA » (BF-5). Exporte `FindAiOverviewUseCase` (section ou `null`)
 * pour le module `cv` ; la route utilise `GetAiOverviewUseCase` (404 si absente).
 */
@Module({
  controllers: [AiOverviewController],
  providers: [
    {
      provide: AI_OVERVIEW_REPOSITORY,
      useFactory: (client: DrizzleDatabaseClient) => new DrizzleAiOverviewRepository(client),
      inject: [DrizzleDatabaseClient],
    },
    {
      provide: FindAiOverviewUseCase,
      useFactory: (aiOverview: AiOverviewRepository) => new FindAiOverviewUseCase(aiOverview),
      inject: [AI_OVERVIEW_REPOSITORY],
    },
    {
      provide: GetAiOverviewUseCase,
      useFactory: (find: FindAiOverviewUseCase) => new GetAiOverviewUseCase(find),
      inject: [FindAiOverviewUseCase],
    },
  ],
  exports: [FindAiOverviewUseCase],
})
export class AiOverviewModule {}
