import { AiOverviewSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type AiOverview } from '../../domain/ai-overview/ai-overview.js';
import { EntityNotFoundError } from '../../domain/errors/entity-not-found.error.js';
import { FindAiOverviewUseCase } from './find-ai-overview.use-case.js';
import { GetAiOverviewUseCase } from './get-ai-overview.use-case.js';
import { type AiOverviewRepository } from './ports/ai-overview-repository.port.js';

const overview: AiOverview = {
  title: 'Titre',
  inProductLabel: 'Produit',
  inProductItems: ['Usage 1', 'Usage 2'],
  dailyLabel: 'Quotidien',
  dailyText: 'Texte',
  skills: [
    {
      slug: 'mastra',
      name: 'Mastra',
      level: 3,
      icon: 'mastra',
      iconPath: '/icons/mastra.svg',
      groupSlug: 'ia',
      mainStackOrder: null,
    },
    {
      slug: 'typescript',
      name: 'TypeScript',
      level: 5,
      icon: 'typescript',
      iconPath: null,
      groupSlug: 'langages',
      mainStackOrder: 1,
    },
  ],
};

function repositoryOf(value: AiOverview | null): AiOverviewRepository & { locales: string[] } {
  const locales: string[] = [];
  return {
    locales,
    findAiOverview: (locale) => {
      locales.push(locale);
      return Promise.resolve(value);
    },
  };
}

describe('FindAiOverviewUseCase (BF-5)', () => {
  it('transmet la langue et reporte chaque champ, compétences dans l’ordre du dépôt', async () => {
    const repository = repositoryOf(overview);

    const result = await new FindAiOverviewUseCase(repository).execute('en');

    expect(repository.locales).toEqual(['en']);
    expect(AiOverviewSchema.parse(result)).toStrictEqual({
      title: 'Titre',
      inProductLabel: 'Produit',
      inProductItems: ['Usage 1', 'Usage 2'],
      dailyLabel: 'Quotidien',
      dailyText: 'Texte',
      skills: overview.skills.map((skill) => ({ ...skill })),
    });
    expect(result?.inProductItems).not.toBe(overview.inProductItems);
  });

  it('renvoie null quand la section est absente', async () => {
    await expect(new FindAiOverviewUseCase(repositoryOf(null)).execute('fr')).resolves.toBeNull();
  });
});

describe('GetAiOverviewUseCase (BF-5)', () => {
  it('renvoie la section trouvée, dans la langue demandée', async () => {
    const repository = repositoryOf(overview);
    const find = new FindAiOverviewUseCase(repository);

    const result = await new GetAiOverviewUseCase(find).execute('fr');

    expect(repository.locales).toEqual(['fr']);
    expect(result.title).toBe('Titre');
  });

  it('lève EntityNotFoundError (404) nommant la section quand elle est absente', async () => {
    const find = new FindAiOverviewUseCase(repositoryOf(null));

    const error = await new GetAiOverviewUseCase(find).execute('fr').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EntityNotFoundError);
    expect(error).toMatchObject({
      entity: 'Section IA',
      identifier: 'ai-overview',
      message: 'Section IA « ai-overview » introuvable.',
    });
  });
});
