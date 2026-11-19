import { type Locale } from '@siteperso/contracts';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { type SelectedFields } from 'drizzle-orm/pg-core';

import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { skillGroups, skills, skillsTranslations } from '../schema/index.js';
import { translated, translationAliases } from '../translated.js';

/**
 * Requête de base partagée par les dépôts `skills`, `skill-groups` et `experiences` : compétences
 * publiées dont le groupe est lui aussi publié, avec leur nom traduit (repli par ligne `en` → `fr` en SQL).
 * L'appelant ajoute ses jointures et son tri, ses colonnes propres via `extra` et une condition
 * supplémentaire via `condition` (le `where` est déjà posé : il ne faut pas le rappeler). Les
 * colonnes de base correspondent au type de domaine `Skill`.
 */
export function selectPublishedSkills<TExtra extends SelectedFields>(
  db: DrizzleDatabaseClient['db'],
  locale: Locale,
  extra: TExtra,
  condition?: SQL,
) {
  const { fr, en } = translationAliases(skillsTranslations);

  return db
    .select({
      slug: skills.slug,
      name: translated(en, fr, 'name'),
      level: skills.level,
      icon: skills.icon,
      iconPath: skills.iconPath,
      groupSlug: skillGroups.slug,
      ...extra,
    })
    .from(skills)
    .innerJoin(
      skillGroups,
      and(
        eq(skillGroups.id, skills.groupId),
        eq(skillGroups.published, true),
        isNull(skillGroups.deletedAt),
      ),
    )
    .innerJoin(fr, and(eq(fr.skillId, skills.id), eq(fr.locale, 'fr')))
    .leftJoin(en, and(eq(en.skillId, skills.id), eq(en.locale, locale)))
    .where(and(eq(skills.published, true), isNull(skills.deletedAt), condition))
    .$dynamic();
}
