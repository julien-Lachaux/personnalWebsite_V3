import { Controller, Get, Query } from '@nestjs/common';
import { type Language, LanguageSchema } from '@siteperso/contracts';

import { ListLanguagesUseCase } from '../../../application/languages/list-languages.use-case.js';
import { parseLocaleQuery } from '../common/locale-query.js';

/** `GET /api/v1/languages` : langues parlées publiées, triées par `sort_order`. */
@Controller('languages')
export class LanguagesController {
  constructor(private readonly listLanguages: ListLanguagesUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<Language[]> {
    const locale = parseLocaleQuery(rawQuery);
    // Validation stricte de la réponse avant envoi.
    return LanguageSchema.array().parse(await this.listLanguages.execute(locale));
  }
}
