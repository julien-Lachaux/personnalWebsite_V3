import { Injectable } from '@nestjs/common';
import { type Locale } from '@siteperso/contracts';
import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { type SkillGroupsRepository } from '../../../application/skill-groups/ports/skill-groups-repository.port.js';
import { type SkillGroup } from '../../../domain/skill-groups/skill-group.js';
import { type Skill } from '../../../domain/skills/skill.js';
import { DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { skillGroups, skillGroupsTranslations, skills } from '../schema/index.js';
import { selectPublishedSkills } from '../skills/select-published-skills.js';
import { translated } from '../translated.js';

/**
 * Implémentation Drizzle du dépôt de groupes de compétences : deux requêtes au total (les groupes,
 * puis toutes leurs compétences d'un coup), assemblées en mémoire par `groupSlug`.
 */
@Injectable()
export class DrizzleSkillGroupsRepository implements SkillGroupsRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAllPublished(locale: Locale): Promise<SkillGroup[]> {
    const fr = alias(skillGroupsTranslations, 'skill_group_fr');
    const en = alias(skillGroupsTranslations, 'skill_group_en');

    const groupsQuery = this.client.db
      .select({
        slug: skillGroups.slug,
        name: translated(en.name, fr.name),
        description: translated<string | null>(en.description, fr.description),
      })
      .from(skillGroups)
      .innerJoin(fr, and(eq(fr.skillGroupId, skillGroups.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.skillGroupId, skillGroups.id), eq(en.locale, locale)))
      .where(eq(skillGroups.published, true))
      .orderBy(asc(skillGroups.sortOrder), asc(skillGroups.id));

    // Les compétences des groupes non publiés sont exclues par la requête de base (jointure sur
    // le groupe publié) : aucune dépendance entre les deux requêtes, elles partent ensemble.
    const skillsQuery = selectPublishedSkills(this.client.db, locale, {}).orderBy(
      asc(skillGroups.sortOrder),
      asc(skills.sortOrder),
      asc(skills.id),
    );

    const [groups, skillRows] = await Promise.all([groupsQuery, skillsQuery]);

    const skillsByGroup = new Map<string, Skill[]>();
    for (const skill of skillRows) {
      const siblings = skillsByGroup.get(skill.groupSlug);
      if (siblings === undefined) {
        skillsByGroup.set(skill.groupSlug, [skill]);
      } else {
        siblings.push(skill);
      }
    }

    return groups.map((group) => ({ ...group, skills: skillsByGroup.get(group.slug) ?? [] }));
  }
}
