import { type Locale } from '@siteperso/contracts';
import { and, eq, isNull, ne, type SQL, sql } from 'drizzle-orm';
import { type AnyPgColumn } from 'drizzle-orm/pg-core';

import { type ProfileRepository } from '../../../application/profile/ports/profile-repository.port.js';
import { type Profile } from '../../../domain/profile/profile.js';
import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { profile, profileTranslations } from '../schema/index.js';
import { translated, translationAliases } from '../translated.js';

/** Colonnes texte du design v6 (BF-1), nullables en base jusqu'à l'étape 3 du lot 15. */
const FRONT_TEXT_COLUMNS = [
  'titleBadge',
  'intro',
  'mission',
  'currentActivity',
  'seekingFormat',
  'seekingLocation',
  'seekingAvailability',
  'cvPath',
] as const;

/** Colonnes contrôlées par `isComplete`, sur l’un ou l’autre alias de `profile_translations`. */
type FrontColumns = Record<(typeof FRONT_TEXT_COLUMNS)[number] | 'taglines', AnyPgColumn>;

/**
 * Ligne de traduction complète : chaque colonne du design v6 est renseignée et non vide, `taglines`
 * compte au moins une accroche, sans élément vide ni nul (`<> ''` est faux pour `null`). Une ligne
 * incomplète est traitée comme absente : le repli par ligne sert alors la ligne `fr` entière, ou
 * aucun profil si c'est la ligne `fr` qui est incomplète. Jamais de mélange de langues, jamais de
 * champ nul servi. Ces conditions doublent les contraintes `not null` et `check` de l'étape 3.
 */
function isComplete(translation: FrontColumns): SQL | undefined {
  return and(
    ...FRONT_TEXT_COLUMNS.map((column) => ne(translation[column], '')),
    sql`cardinality(${translation.taglines}) >= 1`,
    sql`array_position(${translation.taglines}, ''::text) is null`,
    sql`array_position(${translation.taglines}, null::text) is null`,
  );
}

/**
 * Type d'une colonne nullable en base mais garantie renseignée par `isComplete` (jointures) : le
 * SQL produit est inchangé. À retirer quand les colonnes passeront `not null` (étape 3).
 */
const present = <T>(value: SQL<T | null>): SQL<T> => value as SQL<T>;

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
        titleBadge: present(translated(en, fr, 'titleBadge')),
        taglines: present(translated(en, fr, 'taglines')),
        intro: present(translated(en, fr, 'intro')),
        mission: present(translated(en, fr, 'mission')),
        currentActivity: present(translated(en, fr, 'currentActivity')),
        seekingFormat: present(translated(en, fr, 'seekingFormat')),
        seekingLocation: present(translated(en, fr, 'seekingLocation')),
        seekingAvailability: present(translated(en, fr, 'seekingAvailability')),
        cvPath: present(translated(en, fr, 'cvPath')),
      })
      .from(profile)
      .innerJoin(fr, and(eq(fr.profileId, profile.id), eq(fr.locale, 'fr'), isComplete(fr)))
      .leftJoin(en, and(eq(en.profileId, profile.id), eq(en.locale, locale), isComplete(en)))
      .where(and(eq(profile.id, 1), isNull(profile.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }
}
