import { type Locale } from '@siteperso/contracts';

import { type Tool } from '../../../domain/tools/tools.js';

/** Jeton d'injection du dépôt des outils. */
export const TOOLS_REPOSITORY = Symbol('TOOLS_REPOSITORY');

/** Port de lecture des outils. */
export interface ToolsRepository {
  /** Outils publiés triés par `sort_order` puis `id`, textes dans `locale` (repli `fr` par le dépôt). */
  findAllPublished(locale: Locale): Promise<Tool[]>;
}
