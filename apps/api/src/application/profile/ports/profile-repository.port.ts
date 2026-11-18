import { type Locale } from '@siteperso/contracts';

import { type Profile } from '../../../domain/profile/profile.js';

/** Jeton d'injection du dépôt de profil. */
export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export interface ProfileRepository {
  /** Profil traduit (repli `en` → `fr`), ou `null` si la ligne n'existe pas. */
  findProfile(locale: Locale): Promise<Profile | null>;
}
