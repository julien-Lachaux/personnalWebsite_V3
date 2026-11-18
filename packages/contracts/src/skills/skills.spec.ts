import { describe, expect, it } from 'vitest';

import { SkillSchema } from './skills.js';

const valid = {
  slug: 'typescript',
  name: 'TypeScript',
  level: 5,
  icon: 'typescript',
  iconPath: null,
  groupSlug: 'langages',
};

describe('SkillSchema', () => {
  it('accepte une compétence valide (iconPath null ou renseigné)', () => {
    expect(SkillSchema.safeParse(valid).success).toBe(true);
    expect(SkillSchema.safeParse({ ...valid, iconPath: '/icons/ts.svg' }).success).toBe(true);
  });

  it('borne le niveau à 1-5 entier', () => {
    expect(SkillSchema.safeParse({ ...valid, level: 0 }).success).toBe(false);
    expect(SkillSchema.safeParse({ ...valid, level: 6 }).success).toBe(false);
    expect(SkillSchema.safeParse({ ...valid, level: 2.5 }).success).toBe(false);
  });

  it('exige iconPath (nullable, pas optionnel) et refuse les clés inconnues', () => {
    const { iconPath: _omitted, ...withoutIconPath } = valid;
    expect(SkillSchema.safeParse(withoutIconPath).success).toBe(false);
    expect(SkillSchema.safeParse({ ...valid, sortOrder: 1 }).success).toBe(false);
  });
});
