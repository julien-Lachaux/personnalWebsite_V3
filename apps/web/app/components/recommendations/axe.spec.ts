import { createRequire } from 'node:module';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { h, type VNode } from 'vue';

import { type LinkView, type RecommendationView } from '../../data/cv-view.js';
import RecommendationsSection from './RecommendationsSection.vue';

// Contrôle axe (WCAG 2.2 AA) de la section Recommandations montée seule, dans le DOM de test, même
// méthode que `components/base/axe.spec.ts` : axe-core vient de `@axe-core/playwright`. Pas de mise en
// page ici : contraste et taille de cible sont contrôlés ailleurs (tokens.spec.ts, parcours Playwright).
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
async function mountInPage(content: () => VNode, route = '/'): Promise<HTMLElement> {
  const host = document.createElement('main');
  document.body.append(host);
  hosts.push(host);
  const Page = {
    render: (): VNode =>
      h('section', { 'aria-labelledby': 'titre' }, [
        h('h2', { id: 'titre' }, 'Recommandations'),
        content(),
      ]),
  };
  mounted.push(await mountSuspended(Page, { route, attachTo: host }));
  return host;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
});

const source: LinkView = {
  url: 'https://www.linkedin.com/in/example/details/recommendations/',
  label: 'Recommandations publiées sur LinkedIn',
};
const recommendations: RecommendationView[] = [
  {
    slug: 'premiere',
    author: 'Auteur Un',
    role: 'CTO',
    context: 'Responsable direct de Julien · 8 décembre 2025',
    paragraphs: ['Premier paragraphe.', 'Second paragraphe.'],
    lang: 'fr',
  },
  {
    slug: 'seconde',
    author: 'Auteur Deux',
    role: 'Consulting technique',
    context: 'Direct manager · September 25, 2020',
    paragraphs: ['Only paragraph.'],
    lang: 'en',
  },
];

describe('axe sur la section Recommandations', () => {
  it('détecte bien une violation (témoin : lien sans nom accessible)', async () => {
    const host = await mountInPage(() => h('a', { href: '#x' }));

    const violations = await violationsIn(host);

    expect(violations.some((violation) => violation.startsWith('link-name'))).toBe(true);
  });

  it('ne signale rien, citations en deux langues (lang valide)', async () => {
    const host = await mountInPage(() => h(RecommendationsSection, { recommendations, source }));

    expect(await violationsIn(host)).toEqual([]);
  });

  it('ne signale rien en état vide', async () => {
    const host = await mountInPage(() =>
      h(RecommendationsSection, { recommendations: [], source }),
    );

    expect(await violationsIn(host)).toEqual([]);
  });

  it('ne signale rien sans adresse source', async () => {
    const host = await mountInPage(() =>
      h(RecommendationsSection, { recommendations, source: null }),
    );

    expect(await violationsIn(host)).toEqual([]);
  });

  it('ne signale rien sur la page anglaise', async () => {
    const host = await mountInPage(
      () => h(RecommendationsSection, { recommendations, source }),
      '/en',
    );

    expect(await violationsIn(host)).toEqual([]);
  });
});
