import { describe, expect, it } from 'vitest';

import { SkillSchema } from './skills.js';

/** Compétence fictive (BF-3). */
const skill = {
  slug: 'typescript',
  name: 'TypeScript',
  level: 5,
  icon: 'typescript',
  iconPath: null,
  groupSlug: 'langages',
  mainStackOrder: 1,
};

describe('SkillSchema.mainStackOrder (BF-3)', () => {
  it.each([1, 2, 7, 32767, null])('accepte %j', (mainStackOrder) => {
    expect(SkillSchema.parse({ ...skill, mainStackOrder }).mainStackOrder).toBe(mainStackOrder);
  });

  it.each([0, -1, 1.5, '1', true])('refuse %j (entier strictement positif ou null)', (value) => {
    expect(SkillSchema.safeParse({ ...skill, mainStackOrder: value }).success).toBe(false);
  });

  it('exige le champ : nullable, jamais omis', () => {
    const { mainStackOrder: _omitted, ...withoutRank } = skill;
    expect(SkillSchema.safeParse(withoutRank).success).toBe(false);
  });
});
