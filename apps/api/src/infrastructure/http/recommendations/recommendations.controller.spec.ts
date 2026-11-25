import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { type ListRecommendationsUseCase } from '../../../application/recommendations/list-recommendations.use-case.js';
import { RecommendationsController } from './recommendations.controller.js';

const recommendation = {
  slug: 'prenom-nom',
  authorName: 'Prénom Nom',
  authorRole: 'CTO',
  relationship: 'Responsable direct de Julien',
  recommendedOn: '2025-12-08',
  paragraphs: ['Paragraphe.'],
  locale: 'fr',
};

function controllerWith(result: unknown) {
  const execute = vi.fn().mockResolvedValue(result);
  const controller = new RecommendationsController({
    execute,
  } as unknown as ListRecommendationsUseCase);
  return { controller, execute };
}

describe('RecommendationsController (BF-4)', () => {
  it('délègue au cas d’usage en fr par défaut et renvoie la liste validée', async () => {
    const { controller, execute } = controllerWith([recommendation]);

    await expect(controller.list({})).resolves.toEqual([recommendation]);
    expect(execute).toHaveBeenCalledWith('fr');
  });

  it('transmet ?lang=en', async () => {
    const { controller, execute } = controllerWith([]);

    await expect(controller.list({ lang: 'en' })).resolves.toEqual([]);
    expect(execute).toHaveBeenCalledWith('en');
  });

  it.each(['de', 'EN', '', ['fr', 'en']])(
    'refuse lang=%j (BadRequestException) sans appeler le cas d’usage',
    async (lang) => {
      const { controller, execute } = controllerWith([]);

      await expect(controller.list({ lang })).rejects.toBeInstanceOf(BadRequestException);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('refuse de renvoyer une réponse hors contrat (clé en trop, locale inconnue)', async () => {
    await expect(
      controllerWith([{ ...recommendation, sortOrder: 1 }]).controller.list({}),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      controllerWith([{ ...recommendation, locale: 'de' }]).controller.list({}),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
