import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import { cvFr } from '../../data/fixtures/cv.fr.js';
import { mapCv } from '../../data/map-cv.js';
import { techCounter } from '../../domain/filter.js';
import TechOption from './TechOption.vue';

// Coche de la puce pressée (D35, RA-7) côté filtre : la puce de `TechOption` prend la coche de l'élément
// de base `TechChip` (classe `tech-chip--pressed`, styles et rendu dans `TechChip-pressed-mark.spec.ts` et
// `test/chip-pressed-mark.e2e.ts`) quand la techno est choisie, et seulement alors ; ni la puce disponible,
// ni la puce inactive, ni la puce pointillé (sans bouton) ne la portent. Le texte et le nom accessible
// (WCAG 2.5.3) ne changent pas.

const labels = {
  present: 'aujourd’hui',
  breakOrganisation: 'Projet personnel',
  workMode: (value: string) => value,
  contractType: (value: string) => value,
};
const view = mapCv(cvFr, labels);

async function option(slug: string, selected: string[]) {
  const wrapper = await mountSuspended(TechOption, {
    route: '/',
    props: {
      tech: view.techs.all.find((item) => item.slug === slug)!,
      counter: techCounter(view.experiences, selected, slug),
    },
  });
  return wrapper.get('.tech-chip');
}

describe('TechOption : coche de la puce pressée', () => {
  it('la puce choisie porte la marque de l’état pressé, sans changer son texte ni son nom', async () => {
    const chosen = await option('typescript', ['typescript', 'docker']);
    const available = await option('typescript', []);

    expect(chosen.attributes('aria-pressed')).toBe('true');
    expect(chosen.classes()).toContain('tech-chip--pressed');
    expect(chosen.text()).toBe('TypeScript 2');
    expect(chosen.attributes('aria-label')).toBe('TypeScript, 2 expériences');
    expect(chosen.find('[aria-hidden]').exists()).toBe(false);

    expect(available.attributes('aria-pressed')).toBe('false');
    expect(available.classes()).not.toContain('tech-chip--pressed');
  });

  it('la puce inactive (0 résultat) et la puce pointillé ne la portent pas', async () => {
    const disabled = await option('nodejs', ['typescript', 'docker']);
    const unlinked = await option('ai-features', []);

    expect(disabled.attributes('aria-disabled')).toBe('true');
    expect(disabled.classes()).not.toContain('tech-chip--pressed');
    expect(unlinked.element.tagName).toBe('SPAN');
    expect(unlinked.classes()).not.toContain('tech-chip--pressed');
  });
});
