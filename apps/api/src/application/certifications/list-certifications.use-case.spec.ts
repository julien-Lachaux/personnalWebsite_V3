import { CertificationSchema, type Locale } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Certification } from '../../domain/certifications/certifications.js';
import { ListCertificationsUseCase } from './list-certifications.use-case.js';
import { type CertificationsRepository } from './ports/certifications-repository.port.js';

function certification(overrides: Partial<Certification> = {}): Certification {
  return {
    slug: 'exemple',
    issuer: 'Organisme',
    year: 2021,
    url: null,
    name: 'Certification exemple',
    ...overrides,
  };
}

/** Dépôt en mémoire qui mémorise la langue demandée. */
class InMemoryCertificationsRepository implements CertificationsRepository {
  requestedLocale: Locale | undefined;

  constructor(private readonly rows: Certification[]) {}

  findAllPublished(locale: Locale): Promise<Certification[]> {
    this.requestedLocale = locale;
    return Promise.resolve(this.rows);
  }
}

describe('ListCertificationsUseCase', () => {
  it('transmet la langue au dépôt et renvoie un contrat valide', async () => {
    const repository = new InMemoryCertificationsRepository([certification()]);

    const result = await new ListCertificationsUseCase(repository).execute('en');

    expect(repository.requestedLocale).toBe('en');
    expect(result.map((item) => CertificationSchema.parse(item))).toEqual([certification()]);
  });

  it("conserve l'ordre fourni par le dépôt", async () => {
    const repository = new InMemoryCertificationsRepository([
      certification({ slug: 'z-premiere', year: 2015 }),
      certification({ slug: 'a-seconde', year: 2021 }),
    ]);

    const result = await new ListCertificationsUseCase(repository).execute('fr');

    expect(result.map((item) => item.slug)).toEqual(['z-premiere', 'a-seconde']);
  });

  it("conserve l'url nulle ou renseignée", async () => {
    const repository = new InMemoryCertificationsRepository([
      certification({ url: 'https://example.org/verifier' }),
      certification({ slug: 'sans-lien', url: null }),
    ]);

    const result = await new ListCertificationsUseCase(repository).execute('fr');

    expect(result.map((item) => item.url)).toEqual(['https://example.org/verifier', null]);
  });

  it("renvoie une liste vide quand il n'y a aucune certification", async () => {
    const useCase = new ListCertificationsUseCase(new InMemoryCertificationsRepository([]));

    await expect(useCase.execute('fr')).resolves.toEqual([]);
  });
});
