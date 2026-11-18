import { type Locale, type SkillGroup as SkillGroupResponse } from '@siteperso/contracts';

import { type SkillGroupsRepository } from './ports/skill-groups-repository.port.js';

/** Cas d'usage : groupes de compétences publiés avec leurs compétences. Classe pure. */
export class ListSkillGroupsUseCase {
  constructor(private readonly skillGroups: SkillGroupsRepository) {}

  async execute(locale: Locale): Promise<SkillGroupResponse[]> {
    const groups = await this.skillGroups.findAllPublished(locale);
    return groups.map((group) => ({
      slug: group.slug,
      name: group.name,
      description: group.description,
      skills: group.skills.map((skill) => ({
        slug: skill.slug,
        name: skill.name,
        level: skill.level,
        icon: skill.icon,
        iconPath: skill.iconPath,
        groupSlug: skill.groupSlug,
      })),
    }));
  }
}
