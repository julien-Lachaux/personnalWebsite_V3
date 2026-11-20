import { SkillGroupSchema, SkillSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Skill } from '../../domain/skills/skill.js';
import { ListSkillGroupsUseCase } from '../skill-groups/list-skill-groups.use-case.js';
import { ListSkillsUseCase } from './list-skills.use-case.js';

const skill = (slug: string, mainStackOrder: number | null): Skill => ({
  slug,
  name: slug,
  level: 3,
  icon: slug,
  iconPath: null,
  groupSlug: 'langages',
  mainStackOrder,
});

/** L'ordre du dépôt (sort_order) est gardé : le tri par rang est l'affaire du front. */
const skills = [skill('php', null), skill('nodejs', 2), skill('typescript', 1)];

describe('mainStackOrder des compétences (BF-3)', () => {
  it('ListSkillsUseCase reporte le rang de chaque compétence, null compris', async () => {
    const result = await new ListSkillsUseCase({
      findAllPublished: () => Promise.resolve(skills),
    }).execute('fr');

    expect(result.map((item) => SkillSchema.parse(item).mainStackOrder)).toEqual([null, 2, 1]);
  });

  it('ListSkillGroupsUseCase reporte le rang des compétences imbriquées', async () => {
    const [group] = await new ListSkillGroupsUseCase({
      findAllPublished: () =>
        Promise.resolve([{ slug: 'langages', name: 'Langages', description: null, skills }]),
    }).execute('en');

    expect(SkillGroupSchema.parse(group).skills.map((item) => item.mainStackOrder)).toEqual([
      null,
      2,
      1,
    ]);
  });
});
