import { Injectable } from '@nestjs/common';
import { type Locale } from '@siteperso/contracts';
import { and, eq, sql } from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';

import { type ProfileRepository } from '../../../application/profile/ports/profile-repository.port.js';
import { type Profile } from '../../../domain/profile/profile.js';
import { DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { profile, profileTranslations } from '../schema/index.js';

/** Repli de langue en SQL : la traduction demandée si elle existe, sinon le français. */
const translated = (en: AnyPgColumn, fr: AnyPgColumn) => sql<string>`coalesce(${en}, ${fr})`;

/** Implémentation Drizzle du dépôt de profil : une seule requête, repli `en` → `fr` en SQL. */
@Injectable()
export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findProfile(locale: Locale): Promise<Profile | null> {
    const fr = alias(profileTranslations, 'profile_fr');
    const en = alias(profileTranslations, 'profile_en');

    const rows = await this.client.db
      .select({
        firstName: profile.firstName,
        lastName: profile.lastName,
        location: profile.location,
        picturePath: profile.picturePath,
        pictureAlt: translated(en.pictureAlt, fr.pictureAlt),
        title: translated(en.title, fr.title),
        headline: translated(en.headline, fr.headline),
        bio: translated(en.bio, fr.bio),
        availability: translated(en.availability, fr.availability),
      })
      .from(profile)
      .innerJoin(fr, and(eq(fr.profileId, profile.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.profileId, profile.id), eq(en.locale, locale)))
      .where(eq(profile.id, 1))
      .limit(1);

    return rows[0] ?? null;
  }
}
