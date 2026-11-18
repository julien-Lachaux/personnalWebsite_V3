import { type Locale, type Project as ProjectDto } from '@siteperso/contracts';

import { type Project } from '../../domain/projects/projects.js';
import { toImage } from '../common/image.js';
import { type ProjectsRepository } from './ports/projects-repository.port.js';

function toDto(project: Project): ProjectDto {
  return {
    slug: project.slug,
    url: project.url,
    repoUrl: project.repoUrl,
    imageDesktop: toImage(project.imageDesktopPath, project.imageAlt),
    imageMobile: toImage(project.imageMobilePath, project.imageAlt),
    year: project.year,
    title: project.title,
    description: project.description,
    skills: project.skills.map((skill) => ({ ...skill })),
  };
}

/** Cas d'usage : liste des projets publiés dans la langue demandée. Classe pure. */
export class ListProjectsUseCase {
  constructor(private readonly projects: ProjectsRepository) {}

  async execute(locale: Locale): Promise<ProjectDto[]> {
    return (await this.projects.findAllPublished(locale)).map(toDto);
  }
}
