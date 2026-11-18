import { type Image, type Locale, type Resource as ResourceDto } from '@siteperso/contracts';

import { type Resource } from '../../domain/resources/resources.js';
import { type ResourcesRepository } from './ports/resources-repository.port.js';

/**
 * Une image n'est exposée que si son chemin ET son texte alternatif existent : le contrat
 * (`Image`) impose l'alternative pour l'accessibilité.
 */
function toImage(path: string | null, alt: string | null): Image | null {
  return path !== null && path !== '' && alt !== null && alt !== '' ? { path, alt } : null;
}

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
