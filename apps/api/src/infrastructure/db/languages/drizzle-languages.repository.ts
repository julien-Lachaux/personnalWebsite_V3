import { type Locale } from '@siteperso/contracts';
import { and, asc, eq } from 'drizzle-orm';

import { type LanguagesRepository } from '../../../application/languages/ports/languages-repository.port.js';
import { type Language } from '../../../domain/languages/language.js';
import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { languages, languagesTranslations } from '../schema/index.js';
import { translated, translationAliases } from '../translated.js';

/** Implémentation Drizzle du dépôt de langues : une seule requête. */
export class DrizzleLanguagesRepository implements LanguagesRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAllPublished(locale: Locale): Promise<Language[]> {
    const { fr, en } = translationAliases(languagesTranslations);

    return this.client.db
      .select({
        slug: languages.slug,
        code: languages.code,
        cefrLevel: languages.cefrLevel,
        name: translated(en, fr, 'name'),
        levelLabel: translated(en, fr, 'levelLabel'),
      })
      .from(languages)
      .innerJoin(fr, and(eq(fr.languageId, languages.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.languageId, languages.id), eq(en.locale, locale)))
      .where(eq(languages.published, true))
      .orderBy(asc(languages.sortOrder), asc(languages.id));
  }
}
