import { Injectable } from '@nestjs/common';
import { type Locale } from '@siteperso/contracts';
import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { type ResourcesRepository } from '../../../application/resources/ports/resources-repository.port.js';
import { type Resource } from '../../../domain/resources/resources.js';
import { DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { resources, resourcesTranslations, skillGroups } from '../schema/index.js';
import { translated } from '../translated.js';

/**
 * Dépôt Drizzle des ressources. Repli de langue en SQL, en une requête : `fr` obligatoire
 * (inner join), `locale` optionnelle (left join), `coalesce(en, fr)` par champ. Le slug du groupe
 * vient d'un left join sur `skill_groups` limité aux groupes publiés (null sans groupe ou si le
 * groupe n'est pas publié : `/skill-groups` ne l'expose pas, un `groupSlug` y serait orphelin).
 */
@Injectable()
export class DrizzleResourcesRepository implements ResourcesRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAllPublished(locale: Locale): Promise<Resource[]> {
    const fr = alias(resourcesTranslations, 'fr');
    const en = alias(resourcesTranslations, 'en');

    return this.client.db
      .select({
        slug: resources.slug,
        url: resources.url,
        groupSlug: skillGroups.slug,
        picturePath: resources.picturePath,
        pictureAlt: translated<string | null>(en.pictureAlt, fr.pictureAlt),
        name: translated(en.name, fr.name),
        description: translated(en.description, fr.description),
      })
      .from(resources)
      .innerJoin(fr, and(eq(fr.resourceId, resources.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.resourceId, resources.id), eq(en.locale, locale)))
      .leftJoin(
        skillGroups,
        and(eq(skillGroups.id, resources.groupId), eq(skillGroups.published, true)),
      )
      .where(eq(resources.published, true))
      .orderBy(asc(resources.sortOrder), asc(resources.id));
  }
}
