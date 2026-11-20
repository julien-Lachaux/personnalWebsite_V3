import { describe, expect, it } from 'vitest';

import { RecommendationSchema } from './recommendations.js';

/** Recommandation fictive (BF-4). */
const valid = {
  slug: 'prenom-nom',
  authorName: 'Prénom Nom',
  authorRole: 'CTO',
  relationship: 'Responsable direct de Julien',
  recommendedOn: '2025-12-08',
  paragraphs: ['Premier paragraphe.', 'Second paragraphe.'],
  locale: 'fr',
};

type Key = keyof typeof valid;

function without(key: Key): Partial<typeof valid> {
  const copy: Partial<typeof valid> = { ...valid };
  delete copy[key];
  return copy;
}

describe('RecommendationSchema (BF-4)', () => {
  it('accepte une recommandation complète, en fr comme en en', () => {
    expect(RecommendationSchema.parse(valid)).toEqual(valid);
    expect(RecommendationSchema.parse({ ...valid, locale: 'en' }).locale).toBe('en');
  });

  it.each<Key>([
    'slug',
    'authorName',
    'authorRole',
    'relationship',
    'recommendedOn',
    'paragraphs',
    'locale',
  ])('exige %s', (key) => {
    expect(RecommendationSchema.safeParse(without(key)).success).toBe(false);
  });

  it.each(['authorName', 'authorRole', 'relationship'] as const)('refuse %s vide', (key) => {
    expect(RecommendationSchema.safeParse({ ...valid, [key]: '' }).success).toBe(false);
  });

  it('exige au moins un paragraphe, aucun vide', () => {
    expect(RecommendationSchema.safeParse({ ...valid, paragraphs: [] }).success).toBe(false);
    expect(RecommendationSchema.safeParse({ ...valid, paragraphs: ['A', ''] }).success).toBe(false);
    expect(RecommendationSchema.safeParse({ ...valid, paragraphs: 'A' }).success).toBe(false);
    expect(RecommendationSchema.safeParse({ ...valid, paragraphs: ['Seul'] }).success).toBe(true);
  });

  it('exige une date calendaire YYYY-MM-DD et une locale connue', () => {
    for (const recommendedOn of ['2025-02-30', '08/12/2025', '2025-12-08T00:00:00Z']) {
      expect(RecommendationSchema.safeParse({ ...valid, recommendedOn }).success).toBe(false);
    }
    expect(RecommendationSchema.safeParse({ ...valid, locale: 'de' }).success).toBe(false);
  });

  it('refuse une clé inconnue (sort_order, published, coordonnées)', () => {
    for (const key of ['sortOrder', 'published', 'email']) {
      expect(RecommendationSchema.safeParse({ ...valid, [key]: 1 }).success).toBe(false);
    }
  });
});
