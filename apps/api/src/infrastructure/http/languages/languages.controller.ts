import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { type Language, LanguageSchema, LocaleQuerySchema } from '@siteperso/contracts';
import { z } from 'zod';

import { ListLanguagesUseCase } from '../../../application/languages/list-languages.use-case.js';

const LanguagesResponseSchema = z.array(LanguageSchema);

/** `GET /api/v1/languages` : langues parlées publiées, triées par `sort_order`. */
@Controller('languages')
export class LanguagesController {
  constructor(private readonly listLanguages: ListLanguagesUseCase) {}

  @Get()
  async list(@Query() rawQuery: unknown): Promise<Language[]> {
    const query = LocaleQuerySchema.safeParse(rawQuery);
    if (!query.success) {
      throw new BadRequestException('Paramètre « lang » invalide : valeurs acceptées fr, en.');
    }
    const languages = await this.listLanguages.execute(query.data.lang);
    // Validation stricte de la réponse avant envoi.
    return LanguagesResponseSchema.parse(languages);
  }
}
