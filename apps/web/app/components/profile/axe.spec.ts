import { createRequire } from 'node:module';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { h, type VNode } from 'vue';

import { type LinksView, type ProfileView } from '../../data/cv-view.js';
import ProfileSection from './ProfileSection.vue';

// Contrôle axe (WCAG 2.2 AA) de la section Profil montée seule, dans le DOM de test, même méthode que
// `components/base/axe.spec.ts` : axe-core vient de `@axe-core/playwright`. Pas de mise en page ici :
// contraste et taille de cible sont contrôlés ailleurs (tokens.spec.ts, parcours Playwright).
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

/** Monte le composant dans un `<main>` (une page a un repère principal) avec le `h2` que pose la coquille. */
async function mountInPage(content: () => VNode, route = '/'): Promise<HTMLElement> {
  const host = document.createElement('main');
  document.body.append(host);
  hosts.push(host);
  const Page = {
    render: (): VNode =>
      h('section', { 'aria-labelledby': 'titre' }, [h('h2', { id: 'titre' }, 'Profil'), content()]),
  };
  mounted.push(await mountSuspended(Page, { route, attachTo: host }));
  return host;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
});

const profile: ProfileView = {
  title: 'Développeur full-stack',
  titleLines: ['Développeur', 'full-stack'],
  badge: 'senior',
  taglines: ['NestJS, Vue.js : données et analytics', 'Développement assisté par IA'],
  intro: 'Depuis 2017, je conçois des API et des flux de données fiables.',
  mission: 'Je souhaite servir des structures utiles.',
  currently: 'Bénévole deux jours par semaine',
  lookingFor: { format: 'Temps partiel', location: 'Ville, Région', availability: 'Immédiate' },
  cvPath: '/cv/cv-fr.pdf',
};
const links: LinksView = {
  linkedin: { url: 'https://www.linkedin.com/in/example', label: 'LinkedIn' },
  github: { url: 'https://github.com/example', label: 'GitHub' },
  linkedinRecommendations: null,
};

describe('axe sur la section Profil', () => {
  it('détecte bien une violation (témoin : lien sans nom accessible)', async () => {
    const host = await mountInPage(() => h('a', { href: '#x' }));

    const violations = await violationsIn(host);

    expect(violations.some((violation) => violation.startsWith('link-name'))).toBe(true);
  });

  it('ne signale rien, titre en div (coquille porteuse du h1)', async () => {
    const host = await mountInPage(() => h(ProfileSection, { profile, links }));

    expect(await violationsIn(host)).toEqual([]);
  });

  it('ne signale rien, titre en h1, sans GitHub', async () => {
    const host = await mountInPage(() =>
      h(ProfileSection, { profile, links: { ...links, github: null }, titleTag: 'h1' }),
    );

    expect(await violationsIn(host)).toEqual([]);
  });

  it('ne signale rien sur la page anglaise', async () => {
    const host = await mountInPage(() => h(ProfileSection, { profile, links }), '/en');

    expect(await violationsIn(host)).toEqual([]);
  });
});
