import { describe, expect, expectTypeOf, it } from 'vitest';

import { type Cv, CvSchema } from '../cv/cv.js';
import { cvExample } from '../cv/cv.fixtures.js';
import * as contracts from '../index.js';
import { type Recommendation, RecommendationSchema } from './recommendations.js';

describe('recommandations dans le paquet et dans le CV (BF-4)', () => {
  it('le paquet exporte RecommendationSchema', () => {
    expect(contracts.RecommendationSchema).toBe(RecommendationSchema);
  });

  it('Cv.recommendations est un tableau de Recommendation, requis', () => {
    expectTypeOf<Cv['recommendations']>().toEqualTypeOf<Recommendation[]>();
    expect(CvSchema.parse(cvExample).recommendations).toHaveLength(1);
    expect(CvSchema.safeParse({ ...cvExample, recommendations: [] }).success).toBe(true);
    const { recommendations: _omitted, ...withoutRecommendations } = cvExample;
    expect(CvSchema.safeParse(withoutRecommendations).success).toBe(false);
  });

  it('valide en profondeur chaque recommandation du CV', () => {
    const [first] = cvExample.recommendations;
    expect(
      CvSchema.safeParse({ ...cvExample, recommendations: [{ ...first, paragraphs: [] }] }).success,
    ).toBe(false);
  });
});
