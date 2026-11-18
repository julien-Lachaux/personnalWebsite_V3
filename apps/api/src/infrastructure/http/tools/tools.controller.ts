import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { LocaleQuerySchema, type Tool, ToolSchema } from '@siteperso/contracts';

import { ListToolsUseCase } from '../../../application/tools/list-tools.use-case.js';

/** Ressource « outils » : `GET /api/v1/tools?lang=fr|en`. */
@Controller('tools')
export class ToolsController {
  constructor(private readonly listTools: ListToolsUseCase) {}

  @Get()
  async list(@Query() query: unknown): Promise<Tool[]> {
    const parsed = LocaleQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        'Paramètre « lang » invalide : valeurs permises « fr » ou « en ».',
      );
    }
    // Validation stricte de la réponse avant envoi : un écart avec le contrat donne un 500.
    return ToolSchema.array().parse(await this.listTools.execute(parsed.data.lang));
  }
}
