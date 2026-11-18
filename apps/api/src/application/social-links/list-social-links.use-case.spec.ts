import { SocialLinkSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type SocialLink } from '../../domain/social-links/social-link.js';
import { ListSocialLinksUseCase } from './list-social-links.use-case.js';
import { type SocialLinksRepository } from './ports/social-links-repository.port.js';

const links: SocialLink[] = [
  { slug: 'linkedin', kind: 'linkedin', url: 'https://example.com/in/exemple', label: 'LinkedIn' },
  { slug: 'github', kind: 'github', url: 'https://example.com/exemple', label: 'GitHub' },
];

/** Dépôt en mémoire : le tri et le filtrage `published` sont la responsabilité du dépôt. */
function repositoryOf(items: SocialLink[]): SocialLinksRepository & { locales: string[] } {
  const locales: string[] = [];
  return {
    locales,
    findAllPublished: (locale) => {
      locales.push(locale);
      return Promise.resolve(items);
    },
  };
}

describe('ListSocialLinksUseCase', () => {
  it("conserve l'ordre du dépôt et produit des éléments conformes au contrat", async () => {
    const repository = repositoryOf(links);

    const result = await new ListSocialLinksUseCase(repository).execute('fr');

    expect(result.map((link) => link.slug)).toEqual(['linkedin', 'github']);
    for (const link of result) {
      expect(SocialLinkSchema.safeParse(link).success).toBe(true);
    }
  });

  it('transmet la langue au dépôt', async () => {
    const repository = repositoryOf(links);

    await new ListSocialLinksUseCase(repository).execute('en');

    expect(repository.locales).toEqual(['en']);
  });

  it('renvoie un tableau vide sans lien', async () => {
    await expect(new ListSocialLinksUseCase(repositoryOf([])).execute('fr')).resolves.toEqual([]);
  });
});
