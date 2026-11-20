import { type Experience as ExperienceResponse, type Locale } from '@siteperso/contracts';

import { type Experience } from '../../domain/experiences/experience.js';
import { toImage } from '../common/image.js';
import { type ExperiencesRepository } from './ports/experiences-repository.port.js';

/** Cas d'usage : expériences publiées, de la plus récente à la plus ancienne. Classe pure. */
export class ListExperiencesUseCase {
  constructor(private readonly experiences: ExperiencesRepository) {}

  async execute(locale: Locale): Promise<ExperienceResponse[]> {
    const experiences = await this.experiences.findAllPublished(locale);
    return experiences.map(toResponse);
  }
}

function toResponse(experience: Experience): ExperienceResponse {
  return {
    slug: experience.slug,
    kind: experience.kind,
    company: experience.company,
    companyUrl: experience.companyUrl,
    logo: toImage(experience.logoPath, experience.logoAlt),
    contractType: experience.contractType,
    workMode: experience.workMode,
    dateStart: experience.dateStart,
    dateEnd: experience.dateEnd,
    jobTitle: experience.jobTitle,
    location: experience.location,
    summary: experience.summary,
    achievements: [...experience.achievements],
    stackLabel: experience.stackLabel,
    skills: experience.skills.map((skill) => ({
      slug: skill.slug,
      name: skill.name,
      level: skill.level,
      icon: skill.icon,
      iconPath: skill.iconPath,
      groupSlug: skill.groupSlug,
      shownInStack: skill.shownInStack,
    })),
  };
}
