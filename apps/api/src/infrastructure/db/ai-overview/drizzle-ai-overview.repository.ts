import { type Locale } from '@siteperso/contracts';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { type AiOverviewRepository } from '../../../application/ai-overview/ports/ai-overview-repository.port.js';
import { type AiOverview } from '../../../domain/ai-overview/ai-overview.js';
import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { aiOverview, aiOverviewSkills, aiOverviewTranslations, skills } from '../schema/index.js';
import { selectPublishedSkills } from '../skills/select-published-skills.js';
import { translated, translationAliases } from '../translated.js';

/** Identifiant de la ligne unique de la section IA (`check (id = 1)` en base). */
const AI_OVERVIEW_ID = 1;

/**
 * Implémentation Drizzle du dépôt de la section IA : deux requêtes indépendantes, lancées ensemble
 * (la ligne traduite, puis ses compétences publiées liées), pas de N+1.
 */
export class DrizzleAiOverviewRepository implements AiOverviewRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAiOverview(locale: Locale): Promise<AiOverview | null> {
    const { fr, en } = translationAliases(aiOverviewTranslations);

    const overviewQuery = this.client.db
      .select({
        title: translated(en, fr, 'title'),
        inProductLabel: translated(en, fr, 'inProductLabel'),
        inProductItems: translated(en, fr, 'inProductItems'),
        dailyLabel: translated(en, fr, 'dailyLabel'),
        dailyText: translated(en, fr, 'dailyText'),
      })
      .from(aiOverview)
      .innerJoin(fr, and(eq(fr.aiOverviewId, aiOverview.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.aiOverviewId, aiOverview.id), eq(en.locale, locale)))
      .where(and(eq(aiOverview.id, AI_OVERVIEW_ID), isNull(aiOverview.deletedAt)))
      .limit(1);

    // Même requête de base que skills, experiences et projects : compétence ET groupe publiés.
    const skillsQuery = selectPublishedSkills(
      this.client.db,
      locale,
      {},
      eq(aiOverviewSkills.aiOverviewId, AI_OVERVIEW_ID),
    )
      .innerJoin(aiOverviewSkills, eq(aiOverviewSkills.skillId, skills.id))
      .orderBy(asc(aiOverviewSkills.sortOrder), asc(skills.id));

    const [[overview], skillRows] = await Promise.all([overviewQuery, skillsQuery]);

    return overview === undefined ? null : { ...overview, skills: skillRows };
  }
}
