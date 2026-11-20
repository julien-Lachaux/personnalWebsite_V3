import { SkillSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Skill } from '../../domain/skills/skill.js';
import { ListSkillsUseCase } from './list-skills.use-case.js';
import { type SkillsRepository } from './ports/skills-repository.port.js';

const skills: Skill[] = [
  {
    slug: 'typescript',
    name: 'TypeScript',
    level: 5,
    icon: 'typescript',
    iconPath: null,
    groupSlug: 'langages',
    mainStackOrder: 1,
  },
  {
    slug: 'kafka',
    name: 'Kafka',
    level: 3,
    icon: 'apachekafka',
    iconPath: '/icons/kafka.svg',
    groupSlug: 'donnees',
    mainStackOrder: null,
  },
];

/** Dépôt en mémoire : tri et filtrage `published` sont la responsabilité du dépôt. */
function repositoryOf(items: Skill[]): SkillsRepository & { locales: string[] } {
  const locales: string[] = [];
  return {
    locales,
    findAllPublished: (locale) => {
      locales.push(locale);
      return Promise.resolve(items);
    },
  };
}

describe('ListSkillsUseCase', () => {
  it("conserve l'ordre du dépôt et expose groupSlug, conformes au contrat", async () => {
    const result = await new ListSkillsUseCase(repositoryOf(skills)).execute('fr');

    expect(result.map((skill) => skill.slug)).toEqual(['typescript', 'kafka']);
    expect(result.map((skill) => skill.groupSlug)).toEqual(['langages', 'donnees']);
    for (const skill of result) {
      expect(SkillSchema.safeParse(skill).success).toBe(true);
    }
  });

  it('transmet la langue au dépôt', async () => {
    const repository = repositoryOf(skills);

    await new ListSkillsUseCase(repository).execute('en');

    expect(repository.locales).toEqual(['en']);
  });

  it('renvoie un tableau vide sans compétence', async () => {
    await expect(new ListSkillsUseCase(repositoryOf([])).execute('fr')).resolves.toEqual([]);
  });
});
