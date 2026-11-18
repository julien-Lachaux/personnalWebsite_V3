import { Controller, Get, Query } from '@nestjs/common';
import { type Resource, ResourceSchema } from '@siteperso/contracts';

import { ListResourcesUseCase } from '../../../application/resources/list-resources.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** Ressource « ressources recommandées » : `GET /api/v1/resources?lang=fr|en`. */
@Controller('resources')
export class ResourcesController {
  constructor(private readonly listResources: ListResourcesUseCase) {}

  @Get()
  async list(@Query() query: unknown): Promise<Resource[]> {
    const locale = parseLocaleQuery(query);
    // Validation stricte de la réponse avant envoi : un écart avec le contrat donne un 500.
    return ResourceSchema.array().parse(await this.listResources.execute(locale));
  }
}
