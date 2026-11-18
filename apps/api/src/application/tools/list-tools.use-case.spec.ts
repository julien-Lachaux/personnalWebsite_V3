import { type Locale, ToolSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Tool } from '../../domain/tools/tools.js';
import { ListToolsUseCase } from './list-tools.use-case.js';
import { type ToolsRepository } from './ports/tools-repository.port.js';

function tool(overrides: Partial<Tool> = {}): Tool {
  return {
    slug: 'editeur',
    url: 'https://example.org/editeur',
    iconPath: '/images/tools/editeur.svg',
    name: 'Éditeur',
    family: 'IDE',
    description: 'Un éditeur de code.',
    ...overrides,
  };
}

/** Dépôt en mémoire qui mémorise la langue demandée. */
class InMemoryToolsRepository implements ToolsRepository {
  requestedLocale: Locale | undefined;

  constructor(private readonly rows: Tool[]) {}

  findAllPublished(locale: Locale): Promise<Tool[]> {
    this.requestedLocale = locale;
    return Promise.resolve(this.rows);
  }
}

describe('ListToolsUseCase', () => {
  it('transmet la langue au dépôt et renvoie un contrat valide', async () => {
    const repository = new InMemoryToolsRepository([tool()]);

    const result = await new ListToolsUseCase(repository).execute('en');

    expect(repository.requestedLocale).toBe('en');
    expect(result.map((item) => ToolSchema.parse(item))).toEqual([tool()]);
  });

  it("conserve l'ordre fourni par le dépôt", async () => {
    const repository = new InMemoryToolsRepository([
      tool({ slug: 'z-premier' }),
      tool({ slug: 'a-second' }),
    ]);

    const result = await new ListToolsUseCase(repository).execute('fr');

    expect(result.map((item) => item.slug)).toEqual(['z-premier', 'a-second']);
  });

  it('conserve les valeurs nulles du contrat (url, icône)', async () => {
    const repository = new InMemoryToolsRepository([tool({ url: null, iconPath: null })]);

    const [result] = await new ListToolsUseCase(repository).execute('fr');

    expect(ToolSchema.parse(result)).toMatchObject({ url: null, iconPath: null });
  });

  it("renvoie une liste vide quand il n'y a aucun outil", async () => {
    await expect(
      new ListToolsUseCase(new InMemoryToolsRepository([])).execute('fr'),
    ).resolves.toEqual([]);
  });
});
