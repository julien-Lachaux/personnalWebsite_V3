import { describe, expect, it } from 'vitest';

import { ExperienceSchema } from './experiences.js';

const skill = {
  slug: 'typescript',
  name: 'TypeScript',
  level: 5,
  icon: 'typescript',
  iconPath: null,
  groupSlug: 'langages',
  shownInStack: true,
};

const employment = {
  slug: 'societe-exemple',
  kind: 'employment',
  company: 'Société exemple',
  companyUrl: 'https://example.com',
  logo: { path: '/images/logo.webp', alt: 'Logo de la société' },
  contractType: 'cdi',
  workMode: 'hybrid',
  dateStart: '2020-09-01',
  dateEnd: '2024-12-01',
  jobTitle: 'Développeur full-stack',
  location: 'Paris',
  summary: 'Résumé.',
  achievements: ['Une réalisation', 'Une autre'],
  stackLabel: 'Stack',
  skills: [skill],
};

const pause = {
  ...employment,
  slug: 'pause-pro',
  kind: 'break',
  company: null,
  companyUrl: null,
  logo: null,
  contractType: null,
  workMode: null,
  dateEnd: null,
  location: null,
  stackLabel: 'Huile de coude',
};

describe('ExperienceSchema', () => {
  it('accepte une expérience salariée complète', () => {
    expect(ExperienceSchema.safeParse(employment).success).toBe(true);
  });

  it("accepte une pause (kind 'break') sans société", () => {
    expect(ExperienceSchema.safeParse(pause).success).toBe(true);
  });

  it('rejette une date de début invalide', () => {
    expect(ExperienceSchema.safeParse({ ...employment, dateStart: '2026-13-01' }).success).toBe(
      false,
    );
  });

  it('exige un tableau pour achievements', () => {
    expect(ExperienceSchema.safeParse({ ...employment, achievements: 'texte' }).success).toBe(
      false,
    );
  });

  it('rejette les enums inconnus, un champ nullable omis et les clés inconnues', () => {
    expect(ExperienceSchema.safeParse({ ...employment, kind: 'stage' }).success).toBe(false);
    expect(ExperienceSchema.safeParse({ ...employment, workMode: 'office' }).success).toBe(false);
    const { company: _omitted, ...withoutCompany } = employment;
    expect(ExperienceSchema.safeParse(withoutCompany).success).toBe(false);
    expect(ExperienceSchema.safeParse({ ...employment, sortOrder: 1 }).success).toBe(false);
  });
});
