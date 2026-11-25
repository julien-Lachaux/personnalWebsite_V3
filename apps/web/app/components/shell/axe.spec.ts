import { createRequire } from 'node:module';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { h, nextTick, type VNode } from 'vue';
import { clearNuxtState, useRuntimeConfig } from '#imports';

import { PREFERENCES_STATE_KEY, usePreferences } from '../../composables/shell/usePreferences.js';
import AccessibilityPanel from './AccessibilityPanel.vue';
import ActionBar from './ActionBar.vue';
import BottomNav from './BottomNav.vue';
import ContactButton from './ContactButton.vue';
import CvButton from './CvButton.vue';
import HeaderControls from './HeaderControls.vue';
import LanguageSwitch from './LanguageSwitch.vue';
import MobileHeader from './MobileHeader.vue';
import ScrollHint from './ScrollHint.vue';
import ThemeToggle from './ThemeToggle.vue';
import TopBar from './TopBar.vue';

// Contrôle axe (WCAG 2.2 AA) de chaque composant de la coquille monté seul, dans le DOM de test, même
// méthode que `components/base/axe.spec.ts` : axe-core vient de `@axe-core/playwright`. Le DOM de test
// n'a pas de mise en page : contraste et taille de cible sont contrôlés ailleurs (tokens.spec.ts,
// parcours Playwright).
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

const mounted: VueWrapper[] = [];
const hosts: HTMLElement[] = [];
let original = '';

async function mountInPage(
  render: () => VNode,
  route = '/',
): Promise<{ host: HTMLElement; wrapper: VueWrapper }> {
  const host = document.createElement('main');
  document.body.append(host);
  hosts.push(host);
  const wrapper = await mountSuspended({ render }, { route, attachTo: host });
  mounted.push(wrapper);
  return { host, wrapper };
}

beforeEach(() => {
  clearNuxtState(PREFERENCES_STATE_KEY);
  window.localStorage.clear();
  usePreferences().hydrate({ prefersDark: false, prefersReducedMotion: false });
  original = useRuntimeConfig().public.contactEmail;
  // Adresse de test : un placeholder, jamais une vraie adresse.
  useRuntimeConfig().public.contactEmail = 'contact@example.org';
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
  useRuntimeConfig().public.contactEmail = original;
});

const COMMON = { cvPath: '/cv/exemple.pdf', declarationUrl: '/accessibilite' };

describe('axe sur les composants de la coquille', () => {
  it('détecte bien une violation (témoin : bouton sans nom accessible)', async () => {
    const { host } = await mountInPage(() => h('button'));

    const violations = await violationsIn(host);

    expect(violations.some((violation) => violation.startsWith('button-name'))).toBe(true);
  });

  for (const route of ['/', '/en']) {
    describe(`langue ${route}`, () => {
      it('TopBar : vue d’ensemble et section courante', async () => {
        for (const active of [null, 'experience'] as const) {
          const { host, wrapper } = await mountInPage(
            () => h(TopBar, { active, ...COMMON }),
            route,
          );
          expect(await violationsIn(host), `active = ${String(active)}`).toEqual([]);
          wrapper.unmount();
          mounted.splice(mounted.indexOf(wrapper), 1);
          host.remove();
        }
      });

      it('MobileHeader', async () => {
        const { host } = await mountInPage(
          () => h(MobileHeader, { active: 'recommendations', declarationUrl: '/accessibilite' }),
          route,
        );

        expect(await violationsIn(host)).toEqual([]);
      });

      it('BottomNav', async () => {
        const { host } = await mountInPage(() => h(BottomNav, { active: 'ai' }), route);

        expect(await violationsIn(host)).toEqual([]);
      });

      it('ActionBar visible et masquée', async () => {
        for (const hidden of [false, true]) {
          const { host, wrapper } = await mountInPage(
            () => h(ActionBar, { hidden, cvPath: COMMON.cvPath }),
            route,
          );
          expect(await violationsIn(host), `hidden = ${String(hidden)}`).toEqual([]);
          wrapper.unmount();
          mounted.splice(mounted.indexOf(wrapper), 1);
          host.remove();
        }
      });

      it('ScrollHint', async () => {
        const { host } = await mountInPage(() => h(ScrollHint, { visible: true }), route);

        expect(await violationsIn(host)).toEqual([]);
      });

      it('ThemeToggle dans les deux thèmes', async () => {
        const { host } = await mountInPage(() => h(ThemeToggle, {}), route);
        expect(await violationsIn(host)).toEqual([]);

        usePreferences().set('theme', 'clair');
        await nextTick();
        expect(await violationsIn(host)).toEqual([]);
      });

      it('LanguageSwitch', async () => {
        const { host } = await mountInPage(() => h(LanguageSwitch, {}), route);

        expect(await violationsIn(host)).toEqual([]);
      });

      it('ContactButton et CvButton', async () => {
        const contact = await mountInPage(() => h(ContactButton, {}), route);
        const cv = await mountInPage(() => h(CvButton, { href: COMMON.cvPath }), route);

        expect(await violationsIn(contact.host)).toEqual([]);
        expect(await violationsIn(cv.host)).toEqual([]);
      });

      it('HeaderControls', async () => {
        const { host } = await mountInPage(
          () => h(HeaderControls, { declarationUrl: COMMON.declarationUrl }),
          route,
        );

        expect(await violationsIn(host)).toEqual([]);
      });

      it('AccessibilityPanel fermé, puis ouvert avec des réglages activés', async () => {
        const { host, wrapper } = await mountInPage(
          () => h(AccessibilityPanel, { declarationUrl: COMMON.declarationUrl }),
          route,
        );
        expect(await violationsIn(host)).toEqual([]);

        await wrapper.get('button[aria-haspopup="dialog"]').trigger('click');
        await nextTick();
        await wrapper.findAll('[role="switch"]')[0]!.trigger('click');
        await wrapper.findAll('[role="group"][aria-labelledby] button')[1]!.trigger('click');
        await wrapper.get('.a11y-panel__footer button').trigger('click');
        expect(await violationsIn(host)).toEqual([]);
      });
    });
  }
});
