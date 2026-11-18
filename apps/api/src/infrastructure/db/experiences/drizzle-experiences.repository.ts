import { type Locale } from '@siteperso/contracts';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { type ExperiencesRepository } from '../../../application/experiences/ports/experiences-repository.port.js';
import { type Experience } from '../../../domain/experiences/experience.js';
import { type Skill } from '../../../domain/skills/skill.js';
import { type DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { experiences, experienceSkills, experiencesTranslations, skills } from '../schema/index.js';
import { selectPublishedSkills } from '../skills/select-published-skills.js';
import { translated, translationAliases } from '../translated.js';

/**
 * Implémentation Drizzle du dépôt d'expériences : deux requêtes au total (les expériences, puis les
 * compétences de toutes ces expériences d'un coup), assemblées en mémoire par identifiant.
 */
export class DrizzleExperiencesRepository implements ExperiencesRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  async findAllPublished(locale: Locale): Promise<Experience[]> {
    const { fr, en } = translationAliases(experiencesTranslations);

    const rows = await this.client.db
      .select({
        id: experiences.id,
        slug: experiences.slug,
        kind: experiences.kind,
        company: experiences.company,
        companyUrl: experiences.companyUrl,
        logoPath: experiences.logoPath,
        logoAlt: translated(en.logoAlt, fr.logoAlt),
        contractType: experiences.contractType,
        workMode: experiences.workMode,
        dateStart: experiences.dateStart,
        dateEnd: experiences.dateEnd,
        jobTitle: translated(en.jobTitle, fr.jobTitle),
        location: translated(en.location, fr.location),
        summary: translated(en.summary, fr.summary),
        achievements: translated(en.achievements, fr.achievements),
        stackLabel: translated(en.stackLabel, fr.stackLabel),
      })
      .from(experiences)
      .innerJoin(fr, and(eq(fr.experienceId, experiences.id), eq(fr.locale, 'fr')))
      .leftJoin(en, and(eq(en.experienceId, experiences.id), eq(en.locale, locale)))
      .where(eq(experiences.published, true))
      .orderBy(desc(experiences.dateStart), asc(experiences.sortOrder), asc(experiences.id));

    if (rows.length === 0) {
      return [];
    }

    const skillRows = await selectPublishedSkills(
      this.client.db,
      locale,
      { experienceId: experienceSkills.experienceId },
      inArray(
        experienceSkills.experienceId,
        rows.map((row) => row.id),
      ),
    )
      .innerJoin(experienceSkills, eq(experienceSkills.skillId, skills.id))
      .orderBy(asc(experienceSkills.experienceId), asc(experienceSkills.sortOrder), asc(skills.id));

    const skillsByExperience = new Map<number, Skill[]>();
    for (const { experienceId, ...skill } of skillRows) {
      const siblings = skillsByExperience.get(experienceId);
      if (siblings === undefined) {
        skillsByExperience.set(experienceId, [skill]);
      } else {
        siblings.push(skill);
      }
    }

    return rows.map(({ id, ...experience }) => ({
      ...experience,
      skills: skillsByExperience.get(id) ?? [],
    }));
  }
}
