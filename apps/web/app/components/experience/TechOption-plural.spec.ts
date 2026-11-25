import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import { cvEn } from '../../data/fixtures/cv.en.js';
import { cvFr } from '../../data/fixtures/cv.fr.js';
import { mapCv } from '../../data/map-cv.js';
import type { TechCounter } from '../../domain/filter.js';
import TechOption from './TechOption.vue';

// Constat RC-6 : en français, zéro est singulier (« 0 expérience »), comme un. La règle de pluriel de la
// langue est dans la configuration i18n (i18n/i18n.config.ts) ; l'anglais garde la règle par défaut
// (« 0 experiences »).

const labels = {
  present: 'aujourd’hui',
  breakOrganisation: 'Projet personnel',
  workMode: (value: string) => value,
  contractType: (value: string) => value,
};
const viewFr = mapCv(cvFr, labels);
const viewEn = mapCv(cvEn, labels);

/** Puce choisie d'une techno qui affiche `count` expériences (état `selected`, nom `available`). */
function counter(slug: string, count: number): TechCounter {
  return { slug, state: 'selected', count, total: 2, selectable: true };
}

async function label(route: '/' | '/en', count: number): Promise<string | undefined> {
  const view = route === '/' ? viewFr : viewEn;
  const wrapper = await mountSuspended(TechOption, {
    route,
    props: {
      tech: view.techs.all.find((item) => item.slug === 'typescript')!,
      counter: counter('typescript', count),
    },
  });
  return wrapper.get('button').attributes('aria-label');
}

describe('TechOption : pluriel du compteur', () => {
  it.each([
    [0, 'TypeScript, 0 expérience'],
    [1, 'TypeScript, 1 expérience'],
    [2, 'TypeScript, 2 expériences'],
  ])('en français, %i : « %s »', async (count, expected) => {
    expect(await label('/', count)).toBe(expected);
  });

  it.each([
    [0, 'TypeScript, 0 experiences'],
    [1, 'TypeScript, 1 experience'],
    [2, 'TypeScript, 2 experiences'],
  ])('en anglais, %i : « %s »', async (count, expected) => {
    expect(await label('/en', count)).toBe(expected);
  });
});
