import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { LocaleQuerySchema, type Resource, ResourceSchema } from '@siteperso/contracts';

import { ListResourcesUseCase } from '../../../application/resources/list-resources.use-case.js';

/** Ressource « ressources recommandées » : `GET /api/v1/resources?lang=fr|en`. */
@Controller('resources')
export class ResourcesController {
  constructor(private readonly listResources: ListResourcesUseCase) {}

  @Get()
  async list(@Query() query: unknown): Promise<Resource[]> {
    const parsed = LocaleQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        'Paramètre « lang » invalide : valeurs permises « fr » ou « en ».',
      );
    }
    // Validation stricte de la réponse avant envoi : un écart avec le contrat donne un 500.
    return ResourceSchema.array().parse(await this.listResources.execute(parsed.data.lang));
  }
}
