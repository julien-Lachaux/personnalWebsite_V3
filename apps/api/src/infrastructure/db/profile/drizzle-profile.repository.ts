import { type Locale } from '@siteperso/contracts';
import { and, eq, isNull } from 'drizzle-orm';

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
        titleBadge: translated(en, fr, 'titleBadge'),
        taglines: translated(en, fr, 'taglines'),
        intro: translated(en, fr, 'intro'),
        mission: translated(en, fr, 'mission'),
        currentActivity: translated(en, fr, 'currentActivity'),
        seekingFormat: translated(en, fr, 'seekingFormat'),
        seekingLocation: translated(en, fr, 'seekingLocation'),
        seekingAvailability: translated(en, fr, 'seekingAvailability'),
        cvPath: translated(en, fr, 'cvPath'),
      })
      .from(profile)
      .innerJoin(fr, and(eq(fr.profileId, profile.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.profileId, profile.id), eq(en.locale, locale)))
      .where(and(eq(profile.id, 1), isNull(profile.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }
}
