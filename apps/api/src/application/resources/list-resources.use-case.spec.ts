import { type Locale, ResourceSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Resource } from '../../domain/resources/resources.js';
import { ListResourcesUseCase } from './list-resources.use-case.js';
import { type ResourcesRepository } from './ports/resources-repository.port.js';

function resource(overrides: Partial<Resource> = {}): Resource {
  return {
    slug: 'documentation',
    url: 'https://example.org/documentation',
    groupSlug: 'languages-frameworks',
    picturePath: '/images/resources/documentation.webp',
    pictureAlt: 'Page de documentation',
    name: 'Documentation',
    description: 'Une référence.',
    ...overrides,
  };
}

/** Dépôt en mémoire qui mémorise la langue demandée. */
class InMemoryResourcesRepository implements ResourcesRepository {
  requestedLocale: Locale | undefined;

  constructor(private readonly rows: Resource[]) {}

  findAllPublished(locale: Locale): Promise<Resource[]> {
    this.requestedLocale = locale;
    return Promise.resolve(this.rows);
  }
}

describe('ListResourcesUseCase', () => {
  it('transmet la langue au dépôt et renvoie un contrat valide', async () => {
    const repository = new InMemoryResourcesRepository([resource()]);

    const result = await new ListResourcesUseCase(repository).execute('en');

    expect(repository.requestedLocale).toBe('en');
    expect(result.map((item) => ResourceSchema.parse(item))).toEqual([
      {
        slug: 'documentation',
        url: 'https://example.org/documentation',
        groupSlug: 'languages-frameworks',
        picture: { path: '/images/resources/documentation.webp', alt: 'Page de documentation' },
        name: 'Documentation',
        description: 'Une référence.',
      },
    ]);
  });

  it("conserve l'ordre fourni par le dépôt", async () => {
    const repository = new InMemoryResourcesRepository([
      resource({ slug: 'z-premier' }),
      resource({ slug: 'a-second' }),
    ]);

    const result = await new ListResourcesUseCase(repository).execute('fr');

    expect(result.map((item) => item.slug)).toEqual(['z-premier', 'a-second']);
  });

  it("garde groupSlug à null sans groupe et met l'image à null sans texte alternatif", async () => {
    const repository = new InMemoryResourcesRepository([
      resource({ groupSlug: null, pictureAlt: null }),
      resource({ slug: 'sans-image', picturePath: null }),
    ]);

    const [noGroup, noPicture] = await new ListResourcesUseCase(repository).execute('fr');

    expect(noGroup).toMatchObject({ groupSlug: null, picture: null });
    expect(noPicture?.picture).toBeNull();
  });

  it("renvoie une liste vide quand il n'y a aucune ressource", async () => {
    const useCase = new ListResourcesUseCase(new InMemoryResourcesRepository([]));

    await expect(useCase.execute('fr')).resolves.toEqual([]);
  });
});
