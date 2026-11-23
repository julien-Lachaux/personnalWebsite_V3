import { createRequire } from 'node:module';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { h, type VNode } from 'vue';

import AiPlaceholder from './AiPlaceholder.vue';

// Contrôle axe (WCAG 2.2 AA) du placeholder de la section IA monté seul, même méthode que `axe.spec.ts`
// de ce dossier. Le contraste réel (4 palettes) est contrôlé dans le parcours Playwright.
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

/** Monte le composant dans un `<main>` avec le `h2` que pose la coquille. */
async function mountInPage(route = '/'): Promise<HTMLElement> {
  const host = document.createElement('main');
  document.body.append(host);
  hosts.push(host);
  const Page = {
    render: (): VNode =>
      h('section', { 'aria-labelledby': 'titre' }, [
        h('h2', { id: 'titre' }, 'IA'),
        h(AiPlaceholder),
      ]),
  };
  mounted.push(await mountSuspended(Page, { route, attachTo: host }));
  return host;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
});

describe('axe sur le placeholder de la section IA', () => {
  it('ne signale rien en français', async () => {
    const host = await mountInPage();

    expect(host.querySelector('.ai-placeholder')).not.toBeNull();
    expect(await violationsIn(host)).toEqual([]);
  });

  it('ne signale rien sur la page anglaise', async () => {
    const host = await mountInPage('/en');

    expect(host.querySelector('.ai-placeholder')).not.toBeNull();
    expect(await violationsIn(host)).toEqual([]);
  });
});
