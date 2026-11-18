import { Injectable } from '@nestjs/common';
import { type Locale } from '@siteperso/contracts';
import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { type LanguagesRepository } from '../../../application/languages/ports/languages-repository.port.js';
import { type CefrLevel, type Language } from '../../../domain/languages/language.js';
import { DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { languages, languagesTranslations } from '../schema/index.js';
import { translated } from '../translated.js';

/** Implémentation Drizzle du dépôt de langues : une seule requête. */
@Injectable()
export class DrizzleLanguagesRepository implements LanguagesRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAllPublished(locale: Locale): Promise<Language[]> {
    const fr = alias(languagesTranslations, 'language_fr');
    const en = alias(languagesTranslations, 'language_en');

    const rows = await this.client.db
      .select({
        slug: languages.slug,
        code: languages.code,
        cefrLevel: languages.cefrLevel,
        name: translated(en.name, fr.name),
        levelLabel: translated(en.levelLabel, fr.levelLabel),
      })
      .from(languages)
      .innerJoin(fr, and(eq(fr.languageId, languages.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.languageId, languages.id), eq(en.locale, locale)))
      .where(eq(languages.published, true))
      .orderBy(asc(languages.sortOrder), asc(languages.id));

    // La colonne est un `text` ; la contrainte SQL `cefr_level` garantit les valeurs de CefrLevel.
    return rows.map((row) => ({ ...row, cefrLevel: row.cefrLevel as CefrLevel | null }));
  }
}
