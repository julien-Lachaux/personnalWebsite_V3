import { type Experience as ExperienceResponse, type Locale } from '@siteperso/contracts';

import { type Experience } from '../../domain/experiences/experience.js';
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
    // Une image n'est exposée qu'avec son texte alternatif (accessibilité, docs/01) : sans chemin
    // ou sans alt, pas de logo.
    logo:
      experience.logoPath !== null && experience.logoAlt !== null
        ? { path: experience.logoPath, alt: experience.logoAlt }
        : null,
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
    })),
  };
}
