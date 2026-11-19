import { describe, expect, it } from 'vitest';

import { type Experience } from '../../domain/experiences/experience.js';
import { ListExperiencesUseCase } from './list-experiences.use-case.js';
import { type ExperiencesRepository } from './ports/experiences-repository.port.js';

const experience: Experience = {
  slug: 'societe-exemple',
  kind: 'employment',
  company: 'Société exemple',
  companyUrl: null,
  logoPath: null,
  logoAlt: null,
  contractType: 'cdi',
  workMode: 'remote',
  dateStart: '2024-01-01',
  dateEnd: null,
  jobTitle: 'Développeur',
  location: null,
  summary: 'Résumé.',
  achievements: ['Première réalisation', 'Seconde réalisation'],
  stackLabel: null,
  skills: [],
};

function repositoryOf(items: Experience[]): ExperiencesRepository {
  return { findAllPublished: () => Promise.resolve(items) };
}

describe('ListExperiencesUseCase : réalisations', () => {
  it('renvoie les réalisations dans leur ordre', async () => {
    const [result] = await new ListExperiencesUseCase(repositoryOf([experience])).execute('fr');

    expect(result?.achievements).toEqual(['Première réalisation', 'Seconde réalisation']);
  });

  it('renvoie une copie : modifier la réponse ne modifie pas l’entité du dépôt', async () => {
    const [result] = await new ListExperiencesUseCase(repositoryOf([experience])).execute('fr');

    expect(result?.achievements).not.toBe(experience.achievements);
    result?.achievements.push('Ajout côté appelant');
    expect(experience.achievements).toEqual(['Première réalisation', 'Seconde réalisation']);
  });
});
