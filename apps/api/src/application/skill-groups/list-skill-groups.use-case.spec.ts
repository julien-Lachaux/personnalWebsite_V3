import { SkillGroupSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type SkillGroup } from '../../domain/skill-groups/skill-group.js';
import { ListSkillGroupsUseCase } from './list-skill-groups.use-case.js';
import { type SkillGroupsRepository } from './ports/skill-groups-repository.port.js';

const groups: SkillGroup[] = [
  {
    slug: 'langages',
    name: 'Langages',
    description: '',
    skills: [
      {
        slug: 'typescript',
        name: 'TypeScript',
        level: 5,
        icon: 'typescript',
        iconPath: null,
        groupSlug: 'langages',
      },
      {
        slug: 'php',
        name: 'PHP',
        level: 3,
        icon: 'php',
        iconPath: null,
        groupSlug: 'langages',
      },
    ],
  },
  { slug: 'vide', name: 'Groupe sans compétence', description: 'Description', skills: [] },
];

/** Dépôt en mémoire : tri, filtrage `published` et imbrication sont la tâche du dépôt. */
function repositoryOf(items: SkillGroup[]): SkillGroupsRepository & { locales: string[] } {
  const locales: string[] = [];
  return {
    locales,
    findAllPublished: (locale) => {
      locales.push(locale);
      return Promise.resolve(items);
    },
  };
}

describe('ListSkillGroupsUseCase', () => {
  it("conserve l'ordre des groupes et des compétences, conformes au contrat", async () => {
    const result = await new ListSkillGroupsUseCase(repositoryOf(groups)).execute('fr');

    expect(result.map((group) => group.slug)).toEqual(['langages', 'vide']);
    expect(result[0]?.skills.map((skill) => skill.slug)).toEqual(['typescript', 'php']);
    expect(result[1]?.skills).toEqual([]);
    for (const group of result) {
      expect(SkillGroupSchema.safeParse(group).success).toBe(true);
    }
  });

  it('transmet la langue au dépôt', async () => {
    const repository = repositoryOf(groups);

    await new ListSkillGroupsUseCase(repository).execute('en');

    expect(repository.locales).toEqual(['en']);
  });
});
