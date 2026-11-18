import { type Locale } from '@siteperso/contracts';

import { type Education } from '../../../domain/education/education.js';

/** Jeton d'injection du dépôt des formations. */
export const EDUCATION_REPOSITORY = Symbol('EDUCATION_REPOSITORY');

/** Port de lecture des formations. */
export interface EducationRepository {
  /** Formations publiées triées par `sort_order` puis `id`, textes dans `locale` (repli `fr`). */
  findAllPublished(locale: Locale): Promise<Education[]>;
}
