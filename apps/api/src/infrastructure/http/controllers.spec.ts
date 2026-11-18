import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createOpenApiDocument } from '@siteperso/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { type GetCvUseCase } from '../../application/cv/get-cv.use-case.js';
import { type GetHealthUseCase } from '../../application/health/get-health.use-case.js';
import { type GetProfileUseCase } from '../../application/profile/get-profile.use-case.js';
import { CertificationsController } from './certifications/certifications.controller.js';
import { CvController } from './cv/cv.controller.js';
import { DocsController } from './docs/docs.controller.js';
import { EducationController } from './education/education.controller.js';
import { ExperiencesController } from './experiences/experiences.controller.js';
import { HealthController } from './health/health.controller.js';
import { LanguagesController } from './languages/languages.controller.js';
import { ProfileController } from './profile/profile.controller.js';
import { ProjectsController } from './projects/projects.controller.js';
import { ResourcesController } from './resources/resources.controller.js';
import { SkillGroupsController } from './skill-groups/skill-groups.controller.js';
import { SkillsController } from './skills/skills.controller.js';
import { SocialLinksController } from './social-links/social-links.controller.js';
import { ToolsController } from './tools/tools.controller.js';

/** Cas d'usage factice : `execute` renvoie la valeur donnée. */
function useCase<T>(result: T) {
  return { execute: vi.fn().mockResolvedValue(result) };
}

interface ListController {
  list(query: unknown): Promise<unknown>;
}

const LIST_CONTROLLERS: [string, new (useCase: never) => ListController][] = [
  ['SocialLinksController', SocialLinksController],
  ['SkillGroupsController', SkillGroupsController],
  ['SkillsController', SkillsController],
  ['ExperiencesController', ExperiencesController],
  ['ProjectsController', ProjectsController],
  ['ToolsController', ToolsController],
  ['ResourcesController', ResourcesController],
  ['CertificationsController', CertificationsController],
  ['EducationController', EducationController],
  ['LanguagesController', LanguagesController],
];

describe.each(LIST_CONTROLLERS)('%s', (_name, Controller) => {
  it('délègue au cas d’usage avec la langue par défaut fr', async () => {
    const stub = useCase([]);
    const controller = new Controller(stub as never);

    await expect(controller.list({})).resolves.toEqual([]);
    expect(stub.execute).toHaveBeenCalledWith('fr');
  });

  it('transmet ?lang=en', async () => {
    const stub = useCase([]);
    const controller = new Controller(stub as never);

    await controller.list({ lang: 'en' });

    expect(stub.execute).toHaveBeenCalledWith('en');
  });

  it.each(['de', 'EN', '', ['fr', 'en'], 1])(
    'refuse lang=%j avec une BadRequestException sans appeler le cas d’usage',
    async (lang) => {
      const stub = useCase([]);
      const controller = new Controller(stub as never);

      await expect(controller.list({ lang })).rejects.toBeInstanceOf(BadRequestException);
      expect(stub.execute).not.toHaveBeenCalled();
    },
  );

  it('refuse de renvoyer une réponse hors contrat (ZodError, jamais la donnée)', async () => {
    const controller = new Controller(useCase([{ champInattendu: true }]) as never);

    await expect(controller.list({})).rejects.toBeInstanceOf(ZodError);
  });

  it('répercute l’échec du cas d’usage', async () => {
    const stub = { execute: vi.fn().mockRejectedValue(new Error('boum')) };
    const controller = new Controller(stub as never);

    await expect(controller.list({})).rejects.toThrow('boum');
  });
});

const profile = {
  firstName: 'Prénom',
  lastName: 'Nom',
  location: 'Ville',
  picture: { path: '/images/profile.webp', alt: 'Portrait' },
  title: 'Titre',
  headline: 'Accroche',
  bio: 'Présentation.',
  availability: 'Disponible',
};

describe('ProfileController', () => {
  it('renvoie le profil validé', async () => {
    const stub = useCase(profile);
    const controller = new ProfileController(stub as unknown as GetProfileUseCase);

    await expect(controller.get({ lang: 'en' })).resolves.toEqual(profile);
    expect(stub.execute).toHaveBeenCalledWith('en');
  });

  it('refuse une langue inconnue et un profil hors contrat', async () => {
    const controller = new ProfileController(useCase({ ...profile, extra: 1 }) as never);

    await expect(controller.get({ lang: 'de' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.get({})).rejects.toBeInstanceOf(ZodError);
  });
});

describe('CvController', () => {
  const cv = {
    locale: 'fr',
    profile,
    socialLinks: [],
    skillGroups: [],
    experiences: [],
    projects: [],
    tools: [],
    resources: [],
    certifications: [],
    education: [],
    languages: [],
  };

  it('renvoie le CV validé dans la langue demandée', async () => {
    const stub = useCase(cv);
    const controller = new CvController(stub as unknown as GetCvUseCase);

    await expect(controller.get({})).resolves.toEqual(cv);
    expect(stub.execute).toHaveBeenCalledWith('fr');
  });

  it('refuse une langue inconnue et un CV hors contrat', async () => {
    const controller = new CvController(useCase({ ...cv, extra: 1 }) as never);

    await expect(controller.get({ lang: 'de' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.get({})).rejects.toBeInstanceOf(ZodError);
  });
});

describe('HealthController', () => {
  it('renvoie l’état quand la base répond', async () => {
    const health = { status: 'ok', checks: { database: 'up' } };
    const controller = new HealthController(useCase(health) as unknown as GetHealthUseCase);

    await expect(controller.get()).resolves.toEqual(health);
  });

  it('lève une ServiceUnavailableException quand la base est injoignable', async () => {
    const down = { status: 'ok', checks: { database: 'down' } };
    const controller = new HealthController(useCase(down) as unknown as GetHealthUseCase);

    await expect(controller.get()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('DocsController', () => {
  it('sert le document OpenAPI 3.2.0 du contrat', () => {
    const document = new DocsController().get();

    expect(document.openapi).toBe('3.2.0');
    expect(document).toEqual(createOpenApiDocument());
  });
});
