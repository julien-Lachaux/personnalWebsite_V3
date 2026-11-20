import { type Locale, type Skill as SkillResponse } from '@siteperso/contracts';

import { type SkillsRepository } from './ports/skills-repository.port.js';

/** Cas d'usage : compétences publiées à plat, avec leur `groupSlug`. Classe pure, sans décorateur. */
export class ListSkillsUseCase {
  constructor(private readonly skills: SkillsRepository) {}

  async execute(locale: Locale): Promise<SkillResponse[]> {
    const skills = await this.skills.findAllPublished(locale);
    return skills.map((skill) => ({
      slug: skill.slug,
      name: skill.name,
      level: skill.level,
      icon: skill.icon,
      iconPath: skill.iconPath,
      groupSlug: skill.groupSlug,
      mainStackOrder: skill.mainStackOrder,
    }));
  }
}
