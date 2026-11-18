import { LanguageSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Language } from '../../domain/languages/language.js';
import { ListLanguagesUseCase } from './list-languages.use-case.js';
import { type LanguagesRepository } from './ports/languages-repository.port.js';

const languages: Language[] = [
  {
    slug: 'fr',
    code: 'fr',
    cefrLevel: null,
    name: 'Français',
    levelLabel: 'langue maternelle',
  },
  { slug: 'en', code: 'en', cefrLevel: 'C1', name: 'Anglais', levelLabel: 'professionnel' },
];

/** Dépôt en mémoire : tri et filtrage `published` sont la responsabilité du dépôt. */
function repositoryOf(items: Language[]): LanguagesRepository & { locales: string[] } {
  const locales: string[] = [];
  return {
    locales,
    findAllPublished: (locale) => {
      locales.push(locale);
      return Promise.resolve(items);
    },
  };
}

describe('ListLanguagesUseCase', () => {
  it("conserve l'ordre du dépôt, cefrLevel nul accepté, conformes au contrat", async () => {
    const result = await new ListLanguagesUseCase(repositoryOf(languages)).execute('fr');

    expect(result.map((language) => language.cefrLevel)).toEqual([null, 'C1']);
    for (const language of result) {
      expect(LanguageSchema.safeParse(language).success).toBe(true);
    }
  });

  it('transmet la langue au dépôt', async () => {
    const repository = repositoryOf(languages);

    await new ListLanguagesUseCase(repository).execute('en');

    expect(repository.locales).toEqual(['en']);
  });

  it('renvoie un tableau vide sans langue', async () => {
    await expect(new ListLanguagesUseCase(repositoryOf([])).execute('fr')).resolves.toEqual([]);
  });
});
