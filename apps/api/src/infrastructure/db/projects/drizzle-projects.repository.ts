import { Injectable } from '@nestjs/common';
import { type Locale } from '@siteperso/contracts';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { type ProjectsRepository } from '../../../application/projects/ports/projects-repository.port.js';
import { type Project, type ProjectSkill } from '../../../domain/projects/projects.js';
import { DrizzleDatabaseClient } from '../drizzle-database-client.js';
import {
  projects,
  projectSkills,
  projectsTranslations,
  skillGroups,
  skills,
  skillsTranslations,
} from '../schema/index.js';

/**
 * Dépôt Drizzle des projets. Repli de langue en SQL : `fr` obligatoire (inner join), `locale`
 * optionnelle (left join), `coalesce(en, fr)` par champ. Deux requêtes au plus : les projets, puis
 * leurs compétences (pas de N+1).
 */
@Injectable()
export class DrizzleProjectsRepository implements ProjectsRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAllPublished(locale: Locale): Promise<Project[]> {
    const { db } = this.client;
    const fr = alias(projectsTranslations, 'fr');
    const en = alias(projectsTranslations, 'en');

    const rows = await db
      .select({
        id: projects.id,
        slug: projects.slug,
        url: projects.url,
        repoUrl: projects.repoUrl,
        imageDesktopPath: projects.imageDesktopPath,
        imageMobilePath: projects.imageMobilePath,
        year: projects.year,
        title: sql<string>`coalesce(${en.title}, ${fr.title})`,
        description: sql<string>`coalesce(${en.description}, ${fr.description})`,
        imageAlt: sql<string | null>`coalesce(${en.imageAlt}, ${fr.imageAlt})`,
      })
      .from(projects)
      .innerJoin(fr, and(eq(fr.projectId, projects.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.projectId, projects.id), eq(en.locale, locale)))
      .where(eq(projects.published, true))
      .orderBy(asc(projects.sortOrder), asc(projects.id));

    if (rows.length === 0) {
      return [];
    }

    const skillFr = alias(skillsTranslations, 'skill_fr');
    const skillEn = alias(skillsTranslations, 'skill_en');
    const skillRows = await db
      .select({
        projectId: projectSkills.projectId,
        slug: skills.slug,
        name: sql<string>`coalesce(${skillEn.name}, ${skillFr.name})`,
        level: skills.level,
        icon: skills.icon,
        iconPath: skills.iconPath,
        groupSlug: skillGroups.slug,
      })
      .from(projectSkills)
      .innerJoin(skills, eq(skills.id, projectSkills.skillId))
      .innerJoin(skillGroups, eq(skillGroups.id, skills.groupId))
      .innerJoin(skillFr, and(eq(skillFr.skillId, skills.id), eq(skillFr.locale, 'fr')))
      .leftJoin(skillEn, and(eq(skillEn.skillId, skills.id), eq(skillEn.locale, locale)))
      .where(
        and(
          inArray(
            projectSkills.projectId,
            rows.map((row) => row.id),
          ),
          eq(skills.published, true),
        ),
      )
      .orderBy(asc(projectSkills.projectId), asc(projectSkills.sortOrder), asc(skills.id));

    const skillsByProject = new Map<number, ProjectSkill[]>();
    for (const { projectId, ...skill } of skillRows) {
      const list = skillsByProject.get(projectId) ?? [];
      list.push(skill);
      skillsByProject.set(projectId, list);
    }

    return rows.map(({ id, ...project }) => ({
      ...project,
      skills: skillsByProject.get(id) ?? [],
    }));
  }
}
