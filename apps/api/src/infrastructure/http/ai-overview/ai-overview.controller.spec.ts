import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { type GetAiOverviewUseCase } from '../../../application/ai-overview/get-ai-overview.use-case.js';
import { AiOverviewController } from './ai-overview.controller.js';

const overview = {
  title: 'Titre',
  inProductLabel: 'Produit',
  inProductItems: ['Usage'],
  dailyLabel: 'Quotidien',
  dailyText: 'Texte',
  skills: [],
};

function controllerWith(result: unknown) {
  const execute = vi.fn().mockResolvedValue(result);
  const controller = new AiOverviewController({ execute } as unknown as GetAiOverviewUseCase);
  return { controller, execute };
}

describe('AiOverviewController (BF-5)', () => {
  it('délègue au cas d’usage en fr par défaut et renvoie la section validée', async () => {
    const { controller, execute } = controllerWith(overview);

    await expect(controller.get({})).resolves.toEqual(overview);
    expect(execute).toHaveBeenCalledWith('fr');
  });

  it('transmet ?lang=en', async () => {
    const { controller, execute } = controllerWith(overview);

    await controller.get({ lang: 'en' });

    expect(execute).toHaveBeenCalledWith('en');
  });

  it.each(['de', 'EN', '', ['fr', 'en']])(
    'refuse lang=%j (BadRequestException) sans appeler le cas d’usage',
    async (lang) => {
      const { controller, execute } = controllerWith(overview);

      await expect(controller.get({ lang })).rejects.toBeInstanceOf(BadRequestException);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('refuse de renvoyer une réponse hors contrat (clé en trop, usages vides)', async () => {
    await expect(controllerWith({ ...overview, id: 1 }).controller.get({})).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(
      controllerWith({ ...overview, inProductItems: [] }).controller.get({}),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
