import { createRequire } from 'node:module';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { h, nextTick } from 'vue';

import { cvEn } from '../../data/fixtures/cv.en.js';
import { cvFr } from '../../data/fixtures/cv.fr.js';
import { mapCv } from '../../data/map-cv.js';
import ExperienceSection from './ExperienceSection.vue';

// Contrôle axe (WCAG 2.2 AA) de la section Expérience montée seule, dans le DOM de test, même méthode
// que `components/base/axe.spec.ts` : axe-core vient de `@axe-core/playwright`. Le DOM de test n'a ni
// mise en page ni couleurs : contraste et taille de cible sont contrôlés en navigateur
// (`test/experience.e2e.ts`) et par `tokens.spec.ts`.
const resolveFromPlaywrightPackage = createRequire(
  createRequire(import.meta.url).resolve('@axe-core/playwright'),
);
interface AxeResults {
  violations: { id: string; help: string; nodes: { html: string }[] }[];
}
const axe = resolveFromPlaywrightPackage('axe-core') as {
  run: (context: Element, options: object) => Promise<AxeResults>;
};

async function violationsIn(root: Element): Promise<string[]> {
  const results = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  });
  return results.violations.map(
    ({ id, help, nodes }) => `${id} : ${help} (${nodes.map((node) => node.html).join(' | ')})`,
  );
}

const labels = {
  present: 'aujourd’hui',
  breakOrganisation: 'Projet personnel',
  workMode: (value: string) => value,
  contractType: (value: string) => value,
};
const views = { '/': mapCv(cvFr, labels), '/en': mapCv(cvEn, labels) } as const;

const mounted: VueWrapper[] = [];
const hosts: HTMLElement[] = [];

async function mountSection(
  route: keyof typeof views,
  query = '',
): Promise<{ host: HTMLElement; wrapper: VueWrapper }> {
  const host = document.createElement('main');
  document.body.append(host);
  hosts.push(host);
  const view = views[route];
  const wrapper = await mountSuspended(ExperienceSection, {
    route: `${route}${query}`,
    attachTo: host,
    props: { experiences: view.experiences, techs: view.techs },
  });
  mounted.push(wrapper);
  await nextTick();
  return { host, wrapper };
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
});

describe('axe sur la section Expérience', () => {
  it('détecte bien une violation (témoin : bouton sans nom accessible)', async () => {
    const host = document.createElement('main');
    document.body.append(host);
    hosts.push(host);
    const wrapper = await mountSuspended({ render: () => h('button') }, { attachTo: host });
    mounted.push(wrapper);

    const violations = await violationsIn(host);

    expect(violations.some((violation) => violation.startsWith('button-name'))).toBe(true);
  });

  for (const route of ['/', '/en'] as const) {
    describe(`langue ${route}`, () => {
      it('sans filtre, panneau fermé', async () => {
        const { host } = await mountSection(route);

        expect(await violationsIn(host)).toEqual([]);
      });

      it('avec des filtres et le panneau ouvert (stack principale)', async () => {
        const { host, wrapper } = await mountSection(route, '?tech=typescript,docker');
        await wrapper.get('input').trigger('click');

        expect(wrapper.get('.filter-drawer').classes()).toContain('filter-drawer--open');
        expect(await violationsIn(host)).toEqual([]);
      });

      it('avec « Toutes les technos » déplié (états disponible, choisi, désactivé, pointillé)', async () => {
        const { host, wrapper } = await mountSection(route, '?tech=typescript,docker');
        await wrapper.get('input').trigger('click');
        await wrapper.get('.filter-drawer__actions button').trigger('click');

        expect(wrapper.find('.tech-chip--dashed').exists()).toBe(true);
        expect(wrapper.find('.tech-chip[aria-disabled="true"]').exists()).toBe(true);
        expect(await violationsIn(host)).toEqual([]);
      });

      it('pendant la saisie (suggestions, dont une désactivée)', async () => {
        const { host, wrapper } = await mountSection(route, '?tech=typescript,docker');
        await wrapper.get('input').setValue('s');

        expect(wrapper.find('.suggestions').exists()).toBe(true);
        expect(await violationsIn(host)).toEqual([]);
      });

      it('saisie sans correspondance', async () => {
        const { host, wrapper } = await mountSection(route);
        await wrapper.get('input').setValue('zzz');

        expect(wrapper.find('.suggestions__none').exists()).toBe(true);
        expect(await violationsIn(host)).toEqual([]);
      });

      it('sans résultat complet, les autres expériences dépliées et un accordéon ouvert', async () => {
        const { host, wrapper } = await mountSection(route, '?tech=typescript,php');
        await wrapper.get('.result-groups .base-button--secondary').trigger('click');
        await wrapper.get('.accordion__toggle').trigger('click');

        expect(wrapper.find('.card-intro__partial').exists()).toBe(true);
        expect(await violationsIn(host)).toEqual([]);
      });

      it('avec l’easter egg ouvert', async () => {
        const { wrapper } = await mountSection(route);
        await wrapper
          .findAll('.card-stack button')
          .find((chip) => chip.text() === (route === '/' ? 'Huile de coude' : 'Elbow grease'))!
          .trigger('click');
        await nextTick();

        const dialog = document.body.querySelector('[role="dialog"]')!;
        expect(dialog).not.toBeNull();
        expect(await violationsIn(dialog)).toEqual([]);
      });
    });
  }
});
