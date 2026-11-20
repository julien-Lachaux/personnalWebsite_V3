import { type AiOverview as AiOverviewResponse, type Locale } from '@siteperso/contracts';

import { type AiOverviewRepository } from './ports/ai-overview-repository.port.js';

/**
 * Cas d'usage : section IA, ou `null` quand elle est absente. Utilisé tel quel par `/cv` (clé
 * `aiOverview` à `null`) et par `GetAiOverviewUseCase` (404). Classe pure, sans décorateur.
 */
export class FindAiOverviewUseCase {
  constructor(private readonly aiOverview: AiOverviewRepository) {}

  async execute(locale: Locale): Promise<AiOverviewResponse | null> {
    const overview = await this.aiOverview.findAiOverview(locale);
    if (overview === null) {
      return null;
    }
    return {
      title: overview.title,
      inProductLabel: overview.inProductLabel,
      inProductItems: [...overview.inProductItems],
      dailyLabel: overview.dailyLabel,
      dailyText: overview.dailyText,
      skills: overview.skills.map((skill) => ({
        slug: skill.slug,
        name: skill.name,
        level: skill.level,
        icon: skill.icon,
        iconPath: skill.iconPath,
        groupSlug: skill.groupSlug,
        mainStackOrder: skill.mainStackOrder,
      })),
    };
  }
}
