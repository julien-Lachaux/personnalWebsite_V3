import { type Locale } from '@siteperso/contracts';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { type ProjectsRepository } from '../../../application/projects/ports/projects-repository.port.js';
import { type Project } from '../../../domain/projects/projects.js';
import { type Skill } from '../../../domain/skills/skill.js';
import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { projects, projectSkills, projectsTranslations, skills } from '../schema/index.js';
import { selectPublishedSkills } from '../skills/select-published-skills.js';
import { translated, translationAliases } from '../translated.js';

/**
 * Dépôt Drizzle des projets. Repli de langue en SQL : `fr` obligatoire (inner join), `locale`
 * optionnelle (left join), `coalesce(en, fr)` par champ. Deux requêtes au plus : les projets, puis
 * leurs compétences (pas de N+1).
 */
export class DrizzleProjectsRepository implements ProjectsRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAllPublished(locale: Locale): Promise<Project[]> {
    const { db } = this.client;
    const { fr, en } = translationAliases(projectsTranslations);

    const rows = await db
      .select({
        id: projects.id,
        slug: projects.slug,
        url: projects.url,
        repoUrl: projects.repoUrl,
        imageDesktopPath: projects.imageDesktopPath,
        imageMobilePath: projects.imageMobilePath,
        year: projects.year,
        title: translated(en.title, fr.title),
        description: translated(en.description, fr.description),
        imageAlt: translated(en.imageAlt, fr.imageAlt),
      })
      .from(projects)
      .innerJoin(fr, and(eq(fr.projectId, projects.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.projectId, projects.id), eq(en.locale, locale)))
      .where(eq(projects.published, true))
      .orderBy(asc(projects.sortOrder), asc(projects.id));

    if (rows.length === 0) {
      return [];
    }

    // Même requête de base que `skills` et `experiences` : compétence publiée ET groupe publié.
    const skillRows = await selectPublishedSkills(
      db,
      locale,
      { projectId: projectSkills.projectId },
      inArray(
        projectSkills.projectId,
        rows.map((row) => row.id),
      ),
    )
      .innerJoin(projectSkills, eq(projectSkills.skillId, skills.id))
      .orderBy(asc(projectSkills.projectId), asc(projectSkills.sortOrder), asc(skills.id));

    const skillsByProject = new Map<number, Skill[]>();
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
