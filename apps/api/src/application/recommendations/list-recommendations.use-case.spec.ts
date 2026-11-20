import { type Locale, RecommendationSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Recommendation } from '../../domain/recommendations/recommendation.js';
import { ListRecommendationsUseCase } from './list-recommendations.use-case.js';
import { type RecommendationsRepository } from './ports/recommendations-repository.port.js';

const recommendation = (slug: string, locale: 'fr' | 'en'): Recommendation => ({
  slug,
  authorName: `Auteur ${slug}`,
  authorRole: `Rôle ${slug}`,
  relationship: `Relation ${slug}`,
  recommendedOn: '2025-12-08',
  paragraphs: [`Paragraphe 1 ${slug}`, `Paragraphe 2 ${slug}`],
  locale,
});

/** Dépôt en mémoire : tri, filtrage et repli sont la tâche du dépôt. */
function repositoryOf(items: Recommendation[]): RecommendationsRepository & { locales: Locale[] } {
  const locales: Locale[] = [];
  return {
    locales,
    findAllPublished: (locale) => {
      locales.push(locale);
      return Promise.resolve(items);
    },
  };
}

describe('ListRecommendationsUseCase (BF-4)', () => {
  it('transmet la langue et reporte chaque champ à sa place, dans l’ordre du dépôt', async () => {
    const repository = repositoryOf([recommendation('b', 'en'), recommendation('a', 'fr')]);

    const result = await new ListRecommendationsUseCase(repository).execute('en');

    expect(repository.locales).toEqual(['en']);
    expect(result.map((item) => RecommendationSchema.parse(item))).toStrictEqual([
      {
        slug: 'b',
        authorName: 'Auteur b',
        authorRole: 'Rôle b',
        relationship: 'Relation b',
        recommendedOn: '2025-12-08',
        paragraphs: ['Paragraphe 1 b', 'Paragraphe 2 b'],
        locale: 'en',
      },
      {
        slug: 'a',
        authorName: 'Auteur a',
        authorRole: 'Rôle a',
        relationship: 'Relation a',
        recommendedOn: '2025-12-08',
        paragraphs: ['Paragraphe 1 a', 'Paragraphe 2 a'],
        locale: 'fr',
      },
    ]);
  });

  it('renvoie une copie des paragraphes, jamais le tableau du dépôt', async () => {
    const source = recommendation('a', 'fr');

    const [result] = await new ListRecommendationsUseCase(repositoryOf([source])).execute('fr');

    expect(result?.paragraphs).not.toBe(source.paragraphs);
    expect(result?.paragraphs).toEqual(source.paragraphs);
  });

  it('renvoie une liste vide sans recommandation', async () => {
    await expect(new ListRecommendationsUseCase(repositoryOf([])).execute('fr')).resolves.toEqual(
      [],
    );
  });
});
