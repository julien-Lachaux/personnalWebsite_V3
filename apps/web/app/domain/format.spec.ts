import { describe, expect, it, vi } from 'vitest';

import {
  type ExperienceMetaLabels,
  formatExperienceMeta,
  formatPeriod,
  formatRecommendationDate,
} from './format.js';

// Les libellés viennent de l'i18n du composant ; ici de simples fonctions repérables.
const labels: ExperienceMetaLabels = {
  workMode: (value) => `mode:${value}`,
  contractType: (value) => `contrat:${value}`,
};

describe('formatPeriod', () => {
  it('formate une période terminée en français (mois abrégé et année)', () => {
    expect(formatPeriod('2026-01-01', '2026-05-01', 'fr', 'aujourd’hui')).toBe(
      'janv. 2026 – mai 2026',
    );
  });

  it('reprend les périodes du handoff, mois abrégés compris', () => {
    const present = 'aujourd’hui';
    expect(formatPeriod('2024-04-01', '2025-12-01', 'fr', present)).toBe('avr. 2024 – déc. 2025');
    expect(formatPeriod('2021-03-01', '2024-03-01', 'fr', present)).toBe('mars 2021 – mars 2024');
    expect(formatPeriod('2020-07-01', '2021-02-01', 'fr', present)).toBe('juil. 2020 – févr. 2021');
    expect(formatPeriod('2017-08-01', '2018-06-01', 'fr', present)).toBe('août 2017 – juin 2018');
  });

  it('formate une période terminée en anglais', () => {
    expect(formatPeriod('2026-01-01', '2026-05-01', 'en', 'present')).toBe('Jan 2026 – May 2026');
  });

  it('remplace la date de fin d’une expérience en cours par le libellé injecté', () => {
    expect(formatPeriod('2026-01-01', null, 'fr', 'aujourd’hui')).toBe('janv. 2026 – aujourd’hui');
    expect(formatPeriod('2026-01-01', null, 'en', 'present')).toBe('Jan 2026 – present');
  });

  it('ne glisse pas d’un jour ni d’un mois : le 1er et le dernier jour restent dans leur mois', () => {
    expect(formatPeriod('2026-01-01', '2026-01-31', 'fr', 'x')).toBe('janv. 2026 – janv. 2026');
    expect(formatPeriod('2025-12-31', '2026-01-01', 'en', 'x')).toBe('Dec 2025 – Jan 2026');
  });
});

describe('formatExperienceMeta', () => {
  it('compose « lieu, mode · contrat »', () => {
    expect(
      formatExperienceMeta({ location: 'Paris', workMode: 'hybrid', contractType: 'cdi' }, labels),
    ).toBe('Paris, mode:hybrid · contrat:cdi');
  });

  it('omet le lieu sans séparateur orphelin', () => {
    expect(
      formatExperienceMeta({ location: null, workMode: 'remote', contractType: 'cdi' }, labels),
    ).toBe('mode:remote · contrat:cdi');
  });

  it('omet le mode de travail', () => {
    expect(
      formatExperienceMeta(
        { location: 'Paris', workMode: null, contractType: 'freelance' },
        labels,
      ),
    ).toBe('Paris · contrat:freelance');
  });

  it('omet le contrat', () => {
    expect(
      formatExperienceMeta({ location: 'Paris', workMode: 'onsite', contractType: null }, labels),
    ).toBe('Paris, mode:onsite');
  });

  it('n’affiche rien pour le contrat none (pause professionnelle) et ne demande pas son libellé', () => {
    const contractType = vi.fn((value: string) => labels.contractType(value));
    expect(
      formatExperienceMeta(
        { location: 'Paris', workMode: 'hybrid', contractType: 'none' },
        { ...labels, contractType },
      ),
    ).toBe('Paris, mode:hybrid');
    expect(contractType).not.toHaveBeenCalled();
  });

  it('n’affiche que ce qui existe', () => {
    expect(
      formatExperienceMeta({ location: 'Paris', workMode: null, contractType: null }, labels),
    ).toBe('Paris');
    expect(
      formatExperienceMeta({ location: null, workMode: 'remote', contractType: null }, labels),
    ).toBe('mode:remote');
    expect(
      formatExperienceMeta({ location: null, workMode: null, contractType: 'cdi' }, labels),
    ).toBe('contrat:cdi');
  });

  it('rend un texte vide quand tout manque (pause : pas de lieu, mode ni contrat)', () => {
    expect(
      formatExperienceMeta({ location: null, workMode: null, contractType: null }, labels),
    ).toBe('');
    expect(
      formatExperienceMeta({ location: null, workMode: null, contractType: 'none' }, labels),
    ).toBe('');
  });

  it('traite un texte blanc comme absent et retire les espaces du lieu', () => {
    const workMode = vi.fn((value: string) => labels.workMode(value));
    expect(
      formatExperienceMeta(
        { location: '   ', workMode: ' ', contractType: '' },
        { ...labels, workMode },
      ),
    ).toBe('');
    expect(workMode).not.toHaveBeenCalled();
    expect(
      formatExperienceMeta({ location: '  Melun ', workMode: null, contractType: null }, labels),
    ).toBe('Melun');
  });
});

describe('formatRecommendationDate', () => {
  it('écrit le jour, le mois en toutes lettres et l’année', () => {
    expect(formatRecommendationDate('2025-12-08', 'fr')).toBe('8 décembre 2025');
    expect(formatRecommendationDate('2020-11-04', 'fr')).toBe('4 novembre 2020');
    expect(formatRecommendationDate('2025-12-08', 'en')).toBe('December 8, 2025');
  });

  it('reste dans le bon jour aux bornes du mois', () => {
    expect(formatRecommendationDate('2026-01-01', 'fr')).toBe('1 janvier 2026');
    expect(formatRecommendationDate('2025-12-31', 'en')).toBe('December 31, 2025');
  });
});
