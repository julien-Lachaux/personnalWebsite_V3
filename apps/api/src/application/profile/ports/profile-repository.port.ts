import { type Locale } from '@siteperso/contracts';

import { type Profile } from '../../../domain/profile/profile.js';

/** Jeton d'injection du dépôt de profil. */
export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export interface ProfileRepository {
  /**
   * Profil traduit (repli par ligne `en` → `fr`), ou `null` si la ligne n'existe pas, est marquée
   * supprimée ou si sa traduction `fr` est incomplète. Une traduction `en` incomplète est ignorée :
   * la ligne `fr` est alors servie entière.
   */
  findProfile(locale: Locale): Promise<Profile | null>;
}
