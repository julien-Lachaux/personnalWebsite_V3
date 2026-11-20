import { ExperienceSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type Experience, type ExperienceSkill } from '../../domain/experiences/experience.js';
import { ListExperiencesUseCase } from './list-experiences.use-case.js';

const linked = (slug: string, shownInStack: boolean): ExperienceSkill => ({
  slug,
  name: slug.toUpperCase(),
  level: 3,
  icon: slug,
  iconPath: null,
  groupSlug: 'langages',
  shownInStack,
});

const experience: Experience = {
  slug: 'societe',
  kind: 'employment',
  company: 'Société',
  companyUrl: null,
  logoPath: null,
  logoAlt: null,
  contractType: 'cdi',
  workMode: 'remote',
  dateStart: '2024-01-01',
  dateEnd: null,
  jobTitle: 'Poste',
  location: null,
  summary: '',
  achievements: [],
  stackLabel: null,
  skills: [linked('typescript', true), linked('ocr', false), linked('docker', true)],
};

describe('ListExperiencesUseCase : compétences affichées et cachées (BF-2)', () => {
  it('garde chaque lien, dans l’ordre du dépôt, avec son shownInStack', async () => {
    const [result] = await new ListExperiencesUseCase({
      findAllPublished: () => Promise.resolve([experience]),
    }).execute('fr');

    expect(ExperienceSchema.parse(result).skills).toStrictEqual([
      { ...linked('typescript', true) },
      { ...linked('ocr', false) },
      { ...linked('docker', true) },
    ]);
  });
});
