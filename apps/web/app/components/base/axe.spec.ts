import { createRequire } from 'node:module';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { h, nextTick, ref, type Component, type VNode } from 'vue';

import Accordion from './Accordion.vue';
import Button from './Button.vue';
import LinkButton from './LinkButton.vue';
import Popover from './Popover.vue';
import SegmentedControl from './SegmentedControl.vue';
import SeniorBadge from './SeniorBadge.vue';
import Switch from './Switch.vue';
import TechChip from './TechChip.vue';
import Tile from './Tile.vue';
import Window from './Window.vue';

// Contrôle axe (WCAG 2.2 AA) de chaque élément de base monté seul, dans le DOM de test. axe-core n'est
// pas une dépendance directe du front : on le prend chez `@axe-core/playwright`, qui l'embarque (même
// version que celle des parcours Playwright). Le DOM de test n'a pas de mise en page : les règles
// de contraste et de taille de cible sont contrôlées ailleurs (tokens.spec.ts, parcours Playwright).
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

async function mountInPage(
  component: Component,
  props: Record<string, unknown>,
  slots = {},
): Promise<HTMLElement> {
  const host = document.createElement('main');
  document.body.append(host);
  hosts.push(host);
  mounted.push(await mountSuspended(component, { props, slots, attachTo: host }));
  return host;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
});

describe('axe sur les éléments de base', () => {
  it('détecte bien une violation (témoin : bouton sans nom accessible)', async () => {
    const host = await mountInPage({ render: (): VNode => h(Button) }, {});

    const violations = await violationsIn(host);

    expect(violations.some((violation) => violation.startsWith('button-name'))).toBe(true);
  });

  it('Button et LinkButton, toutes variantes, y compris désactivé et lien externe', async () => {
    const Page = {
      render: (): VNode =>
        h('div', [
          ...(['solid', 'outline', 'secondary', 'linkedin', 'neon', 'link'] as const).flatMap(
            (variant) => [
              h(Button, { variant }, () => `Bouton ${variant}`),
              h(
                LinkButton,
                { href: 'https://example.org', variant, externalLabel: 'nouvel onglet' },
                () => `Lien ${variant}`,
              ),
            ],
          ),
          h(Button, { disabled: true }, () => 'Envoyer'),
          h(LinkButton, { href: '/cv.pdf', download: '' }, () => 'CV PDF'),
        ]),
    };
    const host = await mountInPage(Page, {});

    expect(await violationsIn(host)).toEqual([]);
  });

  it('TechChip : actif, inactif, désactivé, pointillé, avec compteur', async () => {
    const Page = {
      render: (): VNode =>
        h('div', [
          h(
            TechChip,
            { pressed: true, count: 2, 'aria-label': 'TypeScript, 2 expériences' },
            () => 'TypeScript',
          ),
          h(TechChip, { pressed: false, count: 1 }, () => 'Docker'),
          h(TechChip, { pressed: false, disabled: true, count: 0 }, () => 'MySQL'),
          h(TechChip, { dashed: true, count: 0 }, () => 'RabbitMQ'),
          h(TechChip, {}, () => 'Huile de coude'),
        ]),
    };
    const host = await mountInPage(Page, {});

    expect(await violationsIn(host)).toEqual([]);
  });

  it('SeniorBadge dans un titre', async () => {
    const host = await mountInPage(
      { render: () => h('h1', ['Développeur ', h(SeniorBadge, {}, () => 'senior')]) },
      {},
    );

    expect(await violationsIn(host)).toEqual([]);
  });

  it('Accordion replié puis déplié', async () => {
    const open = ref(false);
    const Page = {
      render: (): VNode =>
        h(
          Accordion,
          {
            toggleLabel: 'Voir le détail de Senior Software Engineer',
            modelValue: open.value,
            'onUpdate:modelValue': (value: boolean) => (open.value = value),
          },
          {
            header: () => h('h3', 'Senior Software Engineer'),
            default: () => h('ul', [h('li', 'OCR des tickets de caisse')]),
            footer: () => h(TechChip, {}, () => 'TypeScript'),
          },
        ),
    };
    const host = await mountInPage(Page, {});

    expect(await violationsIn(host)).toEqual([]);
    open.value = true;
    await nextTick();
    expect(await violationsIn(host)).toEqual([]);
  });

  it('Switch et SegmentedControl dans le panneau d’accessibilité', async () => {
    const Page = {
      render: (): VNode =>
        h('div', [
          h('span', { id: 'taille' }, 'taille du texte'),
          h(SegmentedControl, {
            'aria-labelledby': 'taille',
            modelValue: '100',
            options: [
              { value: '100', label: 'A', ariaLabel: 'Taille de texte normale' },
              { value: '115', label: 'A', ariaLabel: 'Grande taille de texte' },
            ],
          }),
          h(SegmentedControl, {
            label: 'Mode',
            modelValue: 'a',
            options: [{ value: 'a', label: 'Alpha' }],
          }),
          h(Switch, {
            label: 'Contraste renforcé',
            description: 'Textes et bordures plus marqués.',
            modelValue: true,
          }),
          h(Switch, { label: 'Police plus lisible', modelValue: false }),
        ]),
    };
    const host = await mountInPage(Page, {});

    expect(await violationsIn(host)).toEqual([]);
  });

  it('Tile : agrandie, réduite, sortie, sans défilement', async () => {
    const Page = {
      render: (): VNode =>
        h('div', [
          h(
            Tile,
            {
              title: 'profil.cv',
              label: 'Profil',
              expandLabel: 'Agrandir Profil',
              collapseLabel: 'Réduire Profil',
            },
            () => h('p', 'Contenu'),
          ),
          h(
            Tile,
            {
              title: 'experience.log',
              label: 'Expérience',
              expandLabel: 'Agrandir Expérience',
              collapseLabel: 'Réduire Expérience',
              expanded: true,
              scrollable: false,
            },
            () => h('p', 'Contenu'),
          ),
          h(
            Tile,
            {
              title: 'ia.md',
              label: 'IA',
              expandLabel: 'Agrandir IA',
              collapseLabel: 'Réduire IA',
              pushedOut: true,
            },
            () => h('p', 'Contenu'),
          ),
        ]),
    };
    const host = await mountInPage(Page, {});

    expect(await violationsIn(host)).toEqual([]);
  });

  it('Window ouverte (modale) et Popover ouvert', async () => {
    const windowOpen = ref(true);
    const popoverOpen = ref(true);
    const Page = {
      render: (): VNode =>
        h('div', [
          h(
            Window,
            {
              open: windowOpen.value,
              'onUpdate:open': (value: boolean) => (windowOpen.value = value),
              title: 'contact.sh',
              closeLabel: 'Fermer le formulaire',
            },
            () => [h('h2', 'Lancer l’entretien'), h(Button, {}, () => 'Envoyer')],
          ),
          h(
            Popover,
            {
              open: popoverOpen.value,
              'onUpdate:open': (value: boolean) => (popoverOpen.value = value),
              title: 'accessibilite.cfg',
              closeLabel: 'Fermer les options d’accessibilité',
            },
            {
              trigger: ({ props }: { props: Record<string, unknown> }) =>
                h('button', { type: 'button', 'aria-label': 'Options d’accessibilité', ...props }),
              default: () => h(Switch, { label: 'Contraste renforcé', modelValue: false }),
            },
          ),
        ]),
    };
    const host = await mountInPage(Page, {});
    await nextTick();

    expect(document.body.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(await violationsIn(document.body)).toEqual([]);
    expect(await violationsIn(host)).toEqual([]);
  });
});
