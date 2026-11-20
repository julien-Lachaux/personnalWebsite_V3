import { type Locale, ProjectSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Project } from '../../domain/projects/projects.js';
import { ListProjectsUseCase } from './list-projects.use-case.js';
import { type ProjectsRepository } from './ports/projects-repository.port.js';

function project(overrides: Partial<Project> = {}): Project {
  return {
    slug: 'site-perso',
    url: 'https://example.org/site',
    repoUrl: null,
    imageDesktopPath: '/images/projects/site-desktop.webp',
    imageMobilePath: '/images/projects/site-mobile.webp',
    imageAlt: "Page d'accueil du site",
    year: 2026,
    title: 'Site perso',
    description: 'Un site.',
    skills: [
      {
        slug: 'typescript',
        name: 'TypeScript',
        level: 4,
        icon: 'typescript',
        iconPath: null,
        groupSlug: 'langages',
        mainStackOrder: 1,
      },
    ],
    ...overrides,
  };
}

/** Dépôt en mémoire qui mémorise la langue demandée. */
class InMemoryProjectsRepository implements ProjectsRepository {
  requestedLocale: Locale | undefined;

  constructor(private readonly rows: Project[]) {}

  findAllPublished(locale: Locale): Promise<Project[]> {
    this.requestedLocale = locale;
    return Promise.resolve(this.rows);
  }
}

describe('ListProjectsUseCase', () => {
  it('transmet la langue au dépôt et renvoie un contrat valide', async () => {
    const repository = new InMemoryProjectsRepository([project()]);

    const result = await new ListProjectsUseCase(repository).execute('en');

    expect(repository.requestedLocale).toBe('en');
    expect(result.map((item) => ProjectSchema.parse(item))).toHaveLength(1);
    expect(result[0]?.imageDesktop).toEqual({
      path: '/images/projects/site-desktop.webp',
      alt: "Page d'accueil du site",
    });
  });

  it("conserve l'ordre du dépôt, projets comme compétences", async () => {
    const skills = ['b', 'a', 'c'].map((slug) => ({
      slug,
      name: slug,
      level: 3,
      icon: slug,
      iconPath: null,
      groupSlug: 'g',
      mainStackOrder: null,
    }));
    const repository = new InMemoryProjectsRepository([
      project({ slug: 'z-premier', skills }),
      project({ slug: 'a-second' }),
    ]);

    const result = await new ListProjectsUseCase(repository).execute('fr');

    expect(result.map((item) => item.slug)).toEqual(['z-premier', 'a-second']);
    expect(result[0]?.skills.map((skill) => skill.slug)).toEqual(['b', 'a', 'c']);
  });

  it("renvoie une liste vide quand il n'y a aucun projet", async () => {
    const useCase = new ListProjectsUseCase(new InMemoryProjectsRepository([]));

    await expect(useCase.execute('fr')).resolves.toEqual([]);
  });

  it('met les images à null sans chemin ou sans texte alternatif', async () => {
    const repository = new InMemoryProjectsRepository([
      project({ imageMobilePath: null }),
      project({ slug: 'sans-alt', imageAlt: null }),
    ]);

    const [partial, noAlt] = await new ListProjectsUseCase(repository).execute('fr');

    expect(partial?.imageDesktop).not.toBeNull();
    expect(partial?.imageMobile).toBeNull();
    expect(noAlt?.imageDesktop).toBeNull();
    expect(noAlt?.imageMobile).toBeNull();
  });

  it('renvoie une année nulle telle quelle (contrat nullable)', async () => {
    const repository = new InMemoryProjectsRepository([project({ year: null })]);

    const [result] = await new ListProjectsUseCase(repository).execute('fr');

    expect(ProjectSchema.parse(result).year).toBeNull();
  });
});
