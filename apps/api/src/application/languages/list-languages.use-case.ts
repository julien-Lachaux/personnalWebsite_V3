import { type Language as LanguageResponse, type Locale } from '@siteperso/contracts';

import { type LanguagesRepository } from './ports/languages-repository.port.js';

/** Cas d'usage : langues parlées publiées, dans l'ordre du dépôt. Classe pure, sans décorateur. */
export class ListLanguagesUseCase {
  constructor(private readonly languages: LanguagesRepository) {}

  async execute(locale: Locale): Promise<LanguageResponse[]> {
    const languages = await this.languages.findAllPublished(locale);
    return languages.map((language) => ({
      slug: language.slug,
      code: language.code,
      cefrLevel: language.cefrLevel,
      name: language.name,
      levelLabel: language.levelLabel,
    }));
  }
}
