import { Controller, Get, Query } from '@nestjs/common';
import { type Recommendation, RecommendationSchema } from '@siteperso/contracts';

import { ListRecommendationsUseCase } from '../../../application/recommendations/list-recommendations.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** `GET /api/v1/recommendations` : recommandations publiées, triées par `sort_order`. */
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly listRecommendations: ListRecommendationsUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<Recommendation[]> {
    const locale = parseLocaleQuery(rawQuery);
    // Validation stricte de la réponse avant envoi.
    return RecommendationSchema.array().parse(await this.listRecommendations.execute(locale));
  }
}
