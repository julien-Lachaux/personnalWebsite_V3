import { Controller, Get, Query } from '@nestjs/common';
import { type AiOverview, AiOverviewSchema } from '@siteperso/contracts';

import { GetAiOverviewUseCase } from '../../../application/ai-overview/get-ai-overview.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** `GET /api/v1/ai-overview` : section IA, 404 problem+json si la ligne n'existe pas. */
@Controller('ai-overview')
export class AiOverviewController {
  constructor(private readonly getAiOverview: GetAiOverviewUseCase) {}

  @Get()
  async get(@Query() rawQuery: unknown): Promise<AiOverview> {
    const locale = parseLocaleQuery(rawQuery);
    // Validation stricte de la réponse : une clé inattendue ou manquante donne un 500, pas une fuite.
    return AiOverviewSchema.parse(await this.getAiOverview.execute(locale));
  }
}
