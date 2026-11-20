import { describe, expect, it } from 'vitest';

import { SkillGroupSchema } from './skill-groups.js';

const skill = {
  slug: 'typescript',
  name: 'TypeScript',
  level: 5,
  icon: 'typescript',
  iconPath: null,
  groupSlug: 'langages',
  mainStackOrder: 1,
};

const valid = {
  slug: 'langages',
  name: 'Langages',
  description: 'Langages maîtrisés',
  skills: [skill],
};

describe('SkillGroupSchema', () => {
  it('accepte un groupe avec ses compétences imbriquées', () => {
    expect(SkillGroupSchema.safeParse(valid).success).toBe(true);
    expect(SkillGroupSchema.safeParse({ ...valid, skills: [] }).success).toBe(true);
  });

  it('valide les compétences imbriquées', () => {
    expect(SkillGroupSchema.safeParse({ ...valid, skills: [{ ...skill, level: 9 }] }).success).toBe(
      false,
    );
    expect(SkillGroupSchema.safeParse({ ...valid, skills: 'typescript' }).success).toBe(false);
  });

  it('accepte une description nulle mais pas absente', () => {
    expect(SkillGroupSchema.safeParse({ ...valid, description: null }).success).toBe(true);
    const { description: _description, ...withoutDescription } = valid;
    expect(SkillGroupSchema.safeParse(withoutDescription).success).toBe(false);
  });
});
