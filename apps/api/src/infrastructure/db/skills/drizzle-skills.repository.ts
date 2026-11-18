import { Injectable } from '@nestjs/common';
import { type Locale } from '@siteperso/contracts';
import { asc } from 'drizzle-orm';

import { type SkillsRepository } from '../../../application/skills/ports/skills-repository.port.js';
import { type Skill } from '../../../domain/skills/skill.js';
import { DrizzleDatabaseClient } from '../drizzle-database-client.js';
import { skillGroups, skills } from '../schema/index.js';
import { selectPublishedSkills } from './select-published-skills.js';

/** Implémentation Drizzle du dépôt de compétences : une seule requête. */
@Injectable()
export class DrizzleSkillsRepository implements SkillsRepository {
  constructor(private readonly client: DrizzleDatabaseClient) {}

  findAllPublished(locale: Locale): Promise<Skill[]> {
    return selectPublishedSkills(this.client.db, locale, {}).orderBy(
      asc(skillGroups.sortOrder),
      asc(skills.sortOrder),
      asc(skills.id),
    );
  }
}
