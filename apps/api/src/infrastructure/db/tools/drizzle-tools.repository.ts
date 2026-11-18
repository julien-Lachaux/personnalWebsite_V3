import { type Locale } from '@siteperso/contracts';
import { and, asc, eq } from 'drizzle-orm';

import { type ToolsRepository } from '../../../application/tools/ports/tools-repository.port.js';
import { type Tool } from '../../../domain/tools/tools.js';
import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { tools, toolsTranslations } from '../schema/index.js';
import { translated, translationAliases } from '../translated.js';

/**
 * Dépôt Drizzle des outils. Repli de langue en SQL, en une requête : `fr` obligatoire
 * (inner join), `locale` optionnelle (left join), `coalesce(en, fr)` par champ.
 */
export class DrizzleToolsRepository implements ToolsRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAllPublished(locale: Locale): Promise<Tool[]> {
    const { fr, en } = translationAliases(toolsTranslations);

    return this.client.db
      .select({
        slug: tools.slug,
        url: tools.url,
        iconPath: tools.iconPath,
        name: translated(en.name, fr.name),
        family: translated(en.family, fr.family),
        description: translated(en.description, fr.description),
      })
      .from(tools)
      .innerJoin(fr, and(eq(fr.toolId, tools.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.toolId, tools.id), eq(en.locale, locale)))
      .where(eq(tools.published, true))
      .orderBy(asc(tools.sortOrder), asc(tools.id));
  }
}
