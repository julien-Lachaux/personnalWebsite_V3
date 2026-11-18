import { EducationSchema, type Locale } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Education } from '../../domain/education/education.js';
import { ListEducationUseCase } from './list-education.use-case.js';
import { type EducationRepository } from './ports/education-repository.port.js';

function education(overrides: Partial<Education> = {}): Education {
  return {
    slug: 'ecole',
    institution: 'École',
    yearStart: 2015,
    yearEnd: 2016,
    url: null,
    title: 'Cursus',
    description: 'Un cursus.',
    ...overrides,
  };
}

/** Dépôt en mémoire qui mémorise la langue demandée. */
class InMemoryEducationRepository implements EducationRepository {
  requestedLocale: Locale | undefined;

  constructor(private readonly rows: Education[]) {}

  findAllPublished(locale: Locale): Promise<Education[]> {
    this.requestedLocale = locale;
    return Promise.resolve(this.rows);
  }
}

describe('ListEducationUseCase', () => {
  it('transmet la langue au dépôt et renvoie un contrat valide', async () => {
    const repository = new InMemoryEducationRepository([education()]);

    const result = await new ListEducationUseCase(repository).execute('en');

    expect(repository.requestedLocale).toBe('en');
    expect(result.map((item) => EducationSchema.parse(item))).toEqual([education()]);
  });

  it("conserve l'ordre fourni par le dépôt", async () => {
    const repository = new InMemoryEducationRepository([
      education({ slug: 'z-premiere' }),
      education({ slug: 'a-seconde' }),
    ]);

    const result = await new ListEducationUseCase(repository).execute('fr');

    expect(result.map((item) => item.slug)).toEqual(['z-premiere', 'a-seconde']);
  });

  it('accepte une formation en cours (yearEnd null)', async () => {
    const repository = new InMemoryEducationRepository([education({ yearEnd: null })]);

    const [result] = await new ListEducationUseCase(repository).execute('fr');

    expect(EducationSchema.parse(result).yearEnd).toBeNull();
  });

  it('renvoie une description absente telle quelle, null (contrat nullable)', async () => {
    const repository = new InMemoryEducationRepository([education({ description: null })]);

    const [result] = await new ListEducationUseCase(repository).execute('fr');

    expect(EducationSchema.parse(result).description).toBeNull();
  });

  it("renvoie une liste vide quand il n'y a aucune formation", async () => {
    const useCase = new ListEducationUseCase(new InMemoryEducationRepository([]));

    await expect(useCase.execute('fr')).resolves.toEqual([]);
  });
});
