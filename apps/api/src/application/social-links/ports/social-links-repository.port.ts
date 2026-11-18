import { type Locale } from '@siteperso/contracts';

import { type SocialLink } from '../../../domain/social-links/social-link.js';

/** Jeton d'injection du dépôt de liens sociaux. */
export const SOCIAL_LINKS_REPOSITORY = Symbol('SOCIAL_LINKS_REPOSITORY');

export interface SocialLinksRepository {
  /** Liens publiés, traduits (repli `en` → `fr`), triés par `sort_order` puis `id`. */
  findAllPublished(locale: Locale): Promise<SocialLink[]>;
}
