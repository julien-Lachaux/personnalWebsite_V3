import { type AiOverview as AiOverviewResponse, type Locale } from '@siteperso/contracts';

import { EntityNotFoundError } from '../../domain/errors/entity-not-found.error.js';
import { type FindAiOverviewUseCase } from './find-ai-overview.use-case.js';

/** Cas d'usage : section IA de `GET /ai-overview` ; absente, elle donne un 404. Classe pure. */
export class GetAiOverviewUseCase {
  constructor(private readonly findAiOverview: Pick<FindAiOverviewUseCase, 'execute'>) {}

  async execute(locale: Locale): Promise<AiOverviewResponse> {
    const overview = await this.findAiOverview.execute(locale);
    if (overview === null) {
      throw new EntityNotFoundError('Section IA', 'ai-overview');
    }
    return overview;
  }
}
