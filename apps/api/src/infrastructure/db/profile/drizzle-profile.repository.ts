import { type Locale } from '@siteperso/contracts';
import { and, eq } from 'drizzle-orm';

import { type ProfileRepository } from '../../../application/profile/ports/profile-repository.port.js';
import { type Profile } from '../../../domain/profile/profile.js';
import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { profile, profileTranslations } from '../schema/index.js';
import { translated, translationAliases } from '../translated.js';

/** Implémentation Drizzle du dépôt de profil : une seule requête, repli `en` → `fr` en SQL. */
export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findProfile(locale: Locale): Promise<Profile | null> {
    const { fr, en } = translationAliases(profileTranslations);

    const rows = await this.client.db
      .select({
        firstName: profile.firstName,
        lastName: profile.lastName,
        location: profile.location,
        picturePath: profile.picturePath,
        pictureAlt: translated(en, fr, 'pictureAlt'),
        title: translated(en, fr, 'title'),
        headline: translated(en, fr, 'headline'),
        bio: translated(en, fr, 'bio'),
        availability: translated(en, fr, 'availability'),
      })
      .from(profile)
      .innerJoin(fr, and(eq(fr.profileId, profile.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.profileId, profile.id), eq(en.locale, locale)))
      .where(eq(profile.id, 1))
      .limit(1);

    return rows[0] ?? null;
  }
}
