import { type Locale } from '@siteperso/contracts';

import { type Certification } from '../../../domain/certifications/certifications.js';

/** Jeton d'injection du dépôt des certifications. */
export const CERTIFICATIONS_REPOSITORY = Symbol('CERTIFICATIONS_REPOSITORY');

/** Port de lecture des certifications. */
export interface CertificationsRepository {
  /** Certifications publiées triées par `sort_order` puis `id`, `name` dans `locale` (repli `fr`). */
  findAllPublished(locale: Locale): Promise<Certification[]>;
}
