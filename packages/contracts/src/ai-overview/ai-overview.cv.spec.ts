import { describe, expect, expectTypeOf, it } from 'vitest';

import { type Cv, CvSchema } from '../cv/cv.js';
import { cvExample } from '../cv/cv.fixtures.js';
import * as contracts from '../index.js';
import { type AiOverview, AiOverviewSchema } from './ai-overview.js';

describe('section IA dans le paquet et dans le CV (BF-5)', () => {
  it('le paquet exporte AiOverviewSchema', () => {
    expect(contracts.AiOverviewSchema).toBe(AiOverviewSchema);
  });

  it('Cv.aiOverview est une section ou null, toujours présente', () => {
    expectTypeOf<Cv['aiOverview']>().toEqualTypeOf<AiOverview | null>();
    expect(CvSchema.parse(cvExample).aiOverview?.title).toBe('L’IA');
    expect(CvSchema.parse({ ...cvExample, aiOverview: null }).aiOverview).toBeNull();
    const { aiOverview: _omitted, ...withoutOverview } = cvExample;
    expect(CvSchema.safeParse(withoutOverview).success).toBe(false);
  });

  it('valide en profondeur la section du CV', () => {
    expect(
      CvSchema.safeParse({ ...cvExample, aiOverview: { ...cvExample.aiOverview, title: '' } })
        .success,
    ).toBe(false);
    expect(CvSchema.safeParse({ ...cvExample, aiOverview: {} }).success).toBe(false);
  });
});
