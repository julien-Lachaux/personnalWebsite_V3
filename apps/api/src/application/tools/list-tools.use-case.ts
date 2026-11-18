import { type Locale, type Tool as ToolDto } from '@siteperso/contracts';

import { type Tool } from '../../domain/tools/tools.js';
import { type ToolsRepository } from './ports/tools-repository.port.js';

function toDto(tool: Tool): ToolDto {
  return {
    slug: tool.slug,
    url: tool.url,
    iconPath: tool.iconPath,
    name: tool.name,
    family: tool.family,
    description: tool.description,
  };
}

/** Cas d'usage : liste des outils publiés dans la langue demandée. Classe pure. */
export class ListToolsUseCase {
  constructor(private readonly tools: ToolsRepository) {}

  async execute(locale: Locale): Promise<ToolDto[]> {
    return (await this.tools.findAllPublished(locale)).map(toDto);
  }
}
