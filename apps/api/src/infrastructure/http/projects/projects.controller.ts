import { Controller, Get, Query } from '@nestjs/common';
import { type Project, ProjectSchema } from '@siteperso/contracts';

import { ListProjectsUseCase } from '../../../application/projects/list-projects.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** Ressource « projets » : `GET /api/v1/projects?lang=fr|en`. */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly listProjects: ListProjectsUseCase) {}

  @Get()
  async list(@Query() query: unknown): Promise<Project[]> {
    const locale = parseLocaleQuery(query);
    // Validation stricte de la réponse avant envoi : un écart avec le contrat donne un 500.
    return ProjectSchema.array().parse(await this.listProjects.execute(locale));
  }
}
