import { type Locale, type Resource as ResourceDto } from '@siteperso/contracts';

import { type Resource } from '../../domain/resources/resources.js';
import { toImage } from '../common/image.js';
import { type ResourcesRepository } from './ports/resources-repository.port.js';

function toDto(resource: Resource): ResourceDto {
  return {
    slug: resource.slug,
    url: resource.url,
    groupSlug: resource.groupSlug,
    picture: toImage(resource.picturePath, resource.pictureAlt),
    name: resource.name,
    description: resource.description,
  };
}

/** Cas d'usage : liste des ressources publiées dans la langue demandée. Classe pure. */
export class ListResourcesUseCase {
  constructor(private readonly resources: ResourcesRepository) {}

  async execute(locale: Locale): Promise<ResourceDto[]> {
    return (await this.resources.findAllPublished(locale)).map(toDto);
  }
}
