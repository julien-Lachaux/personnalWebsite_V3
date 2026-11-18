import { type Locale } from '@siteperso/contracts';

import { type Language } from '../../../domain/languages/language.js';

/** Jeton d'injection du dépôt de langues. */
export const LANGUAGES_REPOSITORY = Symbol('LANGUAGES_REPOSITORY');

export interface LanguagesRepository {
  /** Langues publiées, traduites (repli `en` → `fr`), triées par `sort_order` puis `id`. */
  findAllPublished(locale: Locale): Promise<Language[]>;
}
