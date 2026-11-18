import { ExperienceSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Experience } from '../../domain/experiences/experience.js';
import { ListExperiencesUseCase } from './list-experiences.use-case.js';
import { type ExperiencesRepository } from './ports/experiences-repository.port.js';

const employment: Experience = {
  slug: 'societe-exemple',
  kind: 'employment',
  company: 'Société exemple',
  companyUrl: 'https://example.com',
  logoPath: '/images/logos/societe-exemple.svg',
  logoAlt: 'Logo de la société exemple',
  contractType: 'cdi',
  workMode: 'hybrid',
  dateStart: '2024-01-01',
  dateEnd: null,
  jobTitle: 'Développeur full-stack',
  location: 'Paris',
  summary: 'Résumé.',
  achievements: ['Une réalisation', 'Une autre'],
  stackLabel: 'Stack',
  skills: [
    {
      slug: 'typescript',
      name: 'TypeScript',
      level: 5,
      icon: 'typescript',
      iconPath: null,
      groupSlug: 'langages',
    },
  ],
};

const pause: Experience = {
  ...employment,
  slug: 'pause',
  kind: 'break',
  company: null,
  companyUrl: null,
  logoPath: null,
  logoAlt: null,
  contractType: null,
  workMode: null,
  dateStart: '2023-01-01',
  dateEnd: '2023-12-01',
  location: null,
  achievements: [],
  stackLabel: 'Huile de coude',
  skills: [],
};

/** Dépôt en mémoire : tri `date_start desc` et filtrage `published` sont la tâche du dépôt. */
function repositoryOf(items: Experience[]): ExperiencesRepository & { locales: string[] } {
  const locales: string[] = [];
  return {
    locales,
    findAllPublished: (locale) => {
      locales.push(locale);
      return Promise.resolve(items);
    },
  };
}

describe('ListExperiencesUseCase', () => {
  it("conserve l'ordre du dépôt et produit des éléments conformes au contrat", async () => {
    const result = await new ListExperiencesUseCase(repositoryOf([employment, pause])).execute(
      'fr',
    );

    expect(result.map((experience) => experience.slug)).toEqual(['societe-exemple', 'pause']);
    for (const experience of result) {
      expect(ExperienceSchema.safeParse(experience).success).toBe(true);
    }
  });

  it('regroupe le logo en { path, alt } et le met à null sans chemin', async () => {
    const [first, second] = await new ListExperiencesUseCase(
      repositoryOf([employment, pause]),
    ).execute('fr');

    expect(first?.logo).toEqual({
      path: '/images/logos/societe-exemple.svg',
      alt: 'Logo de la société exemple',
    });
    expect(second?.logo).toBeNull();
  });

  it("n'expose pas un logo dépourvu de texte alternatif", async () => {
    const [result] = await new ListExperiencesUseCase(
      repositoryOf([{ ...employment, logoAlt: null }]),
    ).execute('fr');

    expect(result?.logo).toBeNull();
  });

  it('garde la pause sans société, ses enums nuls et ses compétences vides', async () => {
    const [result] = await new ListExperiencesUseCase(repositoryOf([pause])).execute('fr');

    expect(result).toMatchObject({
      kind: 'break',
      company: null,
      contractType: null,
      workMode: null,
      dateEnd: '2023-12-01',
      stackLabel: 'Huile de coude',
      achievements: [],
      skills: [],
    });
  });

  it('transmet la langue au dépôt', async () => {
    const repository = repositoryOf([]);

    await new ListExperiencesUseCase(repository).execute('en');

    expect(repository.locales).toEqual(['en']);
  });
});
