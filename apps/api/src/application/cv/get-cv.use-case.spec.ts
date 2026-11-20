import { type Cv, CvSchema, type Locale } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { GetCvUseCase, type LocalizedUseCase } from './get-cv.use-case.js';

const skill = {
  slug: 'typescript',
  name: 'TypeScript',
  level: 5,
  icon: 'typescript',
  iconPath: null,
  groupSlug: 'langages',
  mainStackOrder: 1,
};

/** Contenu fictif valide pour `CvSchema` (jamais de donnée réelle). */
const data: Omit<Cv, 'locale'> = {
  profile: {
    firstName: 'Prénom',
    lastName: 'Nom',
    location: 'Melun, Île-de-France',
    picture: { path: '/images/profile.webp', alt: 'Portrait de profil' },
    title: 'Développeur full-stack',
    titleBadge: 'senior',
    taglines: ['Accroche'],
    intro: 'Introduction.',
    mission: 'Mission.',
    currentActivity: 'Activité du moment.',
    seekingFormat: 'Temps partiel',
    seekingLocation: 'Paris',
    seekingAvailability: 'Immédiate',
    cvPath: '/cv/cv-fr.pdf',
  },
  socialLinks: [
    { slug: 'github', kind: 'github', url: 'https://github.com/example', label: 'GitHub' },
  ],
  skillGroups: [
    { slug: 'langages', name: 'Langages', description: 'Langages maîtrisés', skills: [skill] },
  ],
  experiences: [
    {
      slug: 'pause-pro',
      kind: 'break',
      company: null,
      companyUrl: null,
      logo: null,
      contractType: null,
      workMode: null,
      dateStart: '2025-01-01',
      dateEnd: null,
      jobTitle: 'Pause professionnelle',
      location: null,
      summary: 'Résumé.',
      achievements: ['Une réalisation'],
      stackLabel: 'Huile de coude',
      skills: [{ ...skill, shownInStack: true }],
    },
  ],
  projects: [
    {
      slug: 'projet',
      url: null,
      repoUrl: null,
      imageDesktop: null,
      imageMobile: null,
      year: 2026,
      title: 'Projet',
      description: 'Description.',
      skills: [skill],
    },
  ],
  tools: [
    {
      slug: 'editeur',
      url: null,
      iconPath: null,
      name: 'Éditeur',
      family: 'IDE',
      description: 'Éditeur.',
    },
  ],
  resources: [
    {
      slug: 'ressource',
      url: 'https://example.com/ressource',
      groupSlug: null,
      picture: null,
      name: 'Ressource',
      description: 'Description.',
    },
  ],
  certifications: [
    { slug: 'certif', issuer: 'Organisme', year: 2024, url: null, name: 'Certification' },
  ],
  education: [
    {
      slug: 'formation',
      institution: 'École',
      yearStart: 2008,
      yearEnd: null,
      url: null,
      title: 'Formation',
      description: '',
    },
  ],
  languages: [
    { slug: 'fr', code: 'fr', cefrLevel: null, name: 'Français', levelLabel: 'langue maternelle' },
  ],
};

type Key = keyof typeof data;
const KEYS = Object.keys(data) as Key[];

/** Doublure d'un cas d'usage : mémorise les langues reçues, résout `value` ou rejette `error`. */
class Stub<T> implements LocalizedUseCase<T> {
  readonly calls: Locale[] = [];
  gate: Promise<void> | undefined;

  constructor(
    private readonly value: T,
    private readonly error?: Error,
  ) {}

  async execute(locale: Locale): Promise<T> {
    this.calls.push(locale);
    await this.gate;
    if (this.error) {
      throw this.error;
    }
    return this.value;
  }
}

type Stubs = { [K in Key]: Stub<(typeof data)[K]> };

function build(overrides: Partial<Record<Key, Stub<unknown>>> = {}): {
  stubs: Stubs;
  useCase: GetCvUseCase;
} {
  const stubs = Object.fromEntries(
    KEYS.map((key) => [key, overrides[key] ?? new Stub(data[key])]),
  ) as unknown as Stubs;
  const useCase = new GetCvUseCase(
    stubs.profile,
    stubs.socialLinks,
    stubs.skillGroups,
    stubs.experiences,
    stubs.projects,
    stubs.tools,
    stubs.resources,
    stubs.certifications,
    stubs.education,
    stubs.languages,
  );
  return { stubs, useCase };
}

describe('GetCvUseCase', () => {
  it('compose les cas d’usage en un objet validé par CvSchema', async () => {
    const { useCase } = build();

    const cv = await useCase.execute('fr');

    expect(CvSchema.parse(cv)).toEqual({ locale: 'fr', ...data });
  });

  it('transmet la langue à chaque cas d’usage et la renvoie dans locale', async () => {
    const { stubs, useCase } = build();

    const cv = await useCase.execute('en');

    expect(cv.locale).toBe('en');
    for (const key of KEYS) {
      expect(stubs[key].calls, key).toEqual(['en']);
    }
  });

  it('lance les 10 cas d’usage en parallèle (Promise.all)', async () => {
    const { stubs, useCase } = build();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    for (const key of KEYS) {
      stubs[key].gate = gate;
    }

    const pending = useCase.execute('fr');

    // Aucun n'a encore répondu et tous ont déjà été appelés.
    expect(KEYS.every((key) => stubs[key].calls.length === 1)).toBe(true);
    release();
    await expect(pending).resolves.toMatchObject({ locale: 'fr' });
  });

  it.each(KEYS)(
    'rejette toute la réponse quand « %s » échoue (pas de réponse partielle)',
    async (key) => {
      const { useCase } = build({ [key]: new Stub(data[key], new Error(`échec ${key}`)) });

      await expect(useCase.execute('fr')).rejects.toThrow(`échec ${key}`);
    },
  );
});
