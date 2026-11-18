import { Controller, Get, Header } from '@nestjs/common';
import { createOpenApiDocument, type OpenApiDocument } from '@siteperso/contracts';

/** Sert le contrat OpenAPI 3.1 généré depuis les schémas Zod de `@siteperso/contracts`. */
@Controller('docs.json')
export class DocsController {
  private readonly document: OpenApiDocument = createOpenApiDocument();

  @Get()
  @Header('cache-control', 'public, max-age=300')
  get(): OpenApiDocument {
    return this.document;
  }
}
