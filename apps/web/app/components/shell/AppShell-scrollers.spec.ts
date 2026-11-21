import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';
import { useRuntimeConfig } from '#imports';

import { MOSAIC_QUERY } from '../../composables/shell/useShellMode.js';
import AppShell from './AppShell.vue';

// Coquille, lot F5c : `h1` toujours masqué visuellement (le grand titre visible est celui du profil),
// section à défilement propre (`scrollers` : la liste de la section Expérience) qui remplit `<main>`
// pendant son onglet et dont la zone est lue par la barre d'actions et la flèche, marge haute de 28 px
// des onglets Recos et IA. La largeur est simulée par `matchMedia` (requête de la mosaïque).

// Adresse de test : un placeholder, jamais une vraie adresse (SPEC § 11).
const PLACEHOLDER = 'contact@example.org';
const SECTIONS = ['profile', 'experience', 'recommendations', 'ai'] as const;

type Scrollers = Partial<Record<(typeof SECTIONS)[number], HTMLElement | null>>;

let original = '';
const mounted: VueWrapper[] = [];
const zones: HTMLElement[] = [];

function width(mosaic: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === MOSAIC_QUERY ? mosaic : false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

async function mountShell(scrollers?: Scrollers): Promise<VueWrapper> {
  const wrapper = await mountSuspended(AppShell, {
    route: '/',
    attachTo: document.body,
    props: {
      heading: 'Développeur full-stack',
      cvPath: '/cv/exemple.pdf',
      declarationUrl: '/a11y',
      ...(scrollers === undefined ? {} : { scrollers }),
    },
    slots: Object.fromEntries(SECTIONS.map((id) => [id, () => h('p', `contenu ${id}`)])),
  });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
}

/** Zone qui défile d'une section : mesures simulées (2000 px de contenu, 500 px visibles). */
function zone(): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 2000 });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 500 });
  document.body.append(element);
  zones.push(element);
  return element;
}

async function scroll(element: Element, top: number): Promise<void> {
  element.scrollTop = top;
  element.dispatchEvent(new Event('scroll'));
  await nextTick();
}

async function selectTab(wrapper: VueWrapper, index: number): Promise<void> {
  await wrapper.findAll('.bottom-nav button')[index]!.trigger('click');
  await nextTick();
}

beforeEach(() => {
  original = useRuntimeConfig().public.contactEmail;
  useRuntimeConfig().public.contactEmail = PLACEHOLDER;
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const element of zones.splice(0)) element.remove();
  useRuntimeConfig().public.contactEmail = original;
  vi.restoreAllMocks();
});

describe('AppShell : titre de la page', () => {
  for (const mosaic of [false, true]) {
    it(`garde un seul h1, masqué visuellement (${mosaic ? 'bureau' : 'mobile'})`, async () => {
      width(mosaic);
      const wrapper = await mountShell();

      const headings = wrapper.findAll('h1');
      expect(headings).toHaveLength(1);
      expect(headings[0]!.classes()).toContain('visually-hidden');
      expect(headings[0]!.text()).toBe('Développeur full-stack');
    });
  }
});

describe('AppShell : section à défilement propre (onglets)', () => {
  it('marque la section ; <main> défile et se focalise tant que l’onglet est un autre', async () => {
    width(false);
    const wrapper = await mountShell({ experience: zone() });

    expect(wrapper.get('#section-experience').classes()).toContain(
      'app-shell__section--self-scrolling',
    );
    expect(wrapper.get('#section-profile').classes()).not.toContain(
      'app-shell__section--self-scrolling',
    );
    expect(wrapper.get('main').classes()).not.toContain('app-shell__main--self-scrolling');
    expect(wrapper.get('main').attributes('tabindex')).toBe('0');
  });

  it('pendant son onglet : <main> ne défile plus, la barre d’actions suit la zone de la section', async () => {
    width(false);
    const list = zone();
    const wrapper = await mountShell({ experience: list });
    const main = wrapper.get('main');

    await selectTab(wrapper, 1);

    expect(main.classes()).toContain('app-shell__main--self-scrolling');
    expect(main.attributes('tabindex')).toBe('-1');
    // Défiler <main> ne masque rien : il n'est plus la zone lue.
    await scroll(main.element, 300);
    expect(wrapper.get('.action-bar').classes()).not.toContain('action-bar--hidden');
    // Défiler la liste de la section masque la barre.
    await scroll(list, 300);
    expect(wrapper.get('.action-bar').classes()).toContain('action-bar--hidden');
  });

  it('pendant son onglet : la flèche mesure la zone de la section et la fait défiler', async () => {
    width(false);
    const list = zone();
    const scrollBy = vi.fn();
    list.scrollBy = scrollBy;
    const wrapper = await mountShell({ experience: list });
    await selectTab(wrapper, 1);

    await scroll(list, 0);
    await wrapper.get('.scroll-hint').trigger('click');

    expect(scrollBy).toHaveBeenCalledWith({ top: 400, behavior: 'smooth' });
  });

  it('retour à un autre onglet : <main> redevient la zone qui défile', async () => {
    width(false);
    const list = zone();
    const wrapper = await mountShell({ experience: list });
    const main = wrapper.get('main');
    await selectTab(wrapper, 1);
    await selectTab(wrapper, 0);

    expect(main.classes()).not.toContain('app-shell__main--self-scrolling');
    expect(main.attributes('tabindex')).toBe('0');
    await scroll(list, 300);
    expect(wrapper.get('.action-bar').classes()).not.toContain('action-bar--hidden');
    await scroll(main.element, 300);
    expect(wrapper.get('.action-bar').classes()).toContain('action-bar--hidden');
  });

  it('section pas encore montée (zone nulle) : aucune zone lue, puis la sienne dès qu’elle existe', async () => {
    width(false);
    const wrapper = await mountShell({ experience: null });
    const main = wrapper.get('main').element;
    Object.defineProperty(main, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(main, 'clientHeight', { configurable: true, value: 500 });
    await selectTab(wrapper, 1);

    expect(wrapper.get('main').classes()).toContain('app-shell__main--self-scrolling');
    await scroll(main, 0);
    expect(wrapper.find('.scroll-hint').exists()).toBe(false);

    const list = zone();
    await wrapper.setProps({ scrollers: { experience: list } });
    await scroll(list, 0);
    expect(wrapper.find('.scroll-hint').exists()).toBe(true);
  });

  it('bureau : la section est marquée, aucune zone n’est lue (la page défile)', async () => {
    width(true);
    const list = zone();
    const wrapper = await mountShell({ experience: list });

    expect(wrapper.get('#section-experience').classes()).toContain(
      'app-shell__section--self-scrolling',
    );
    expect(wrapper.get('main').classes()).not.toContain('app-shell__main--self-scrolling');
    expect(wrapper.find('.action-bar').exists()).toBe(false);
  });
});

describe('AppShell : marge haute des onglets (maquette mobile)', () => {
  it('28 px pour Recos et IA, 20 px pour Profil et XP', async () => {
    width(false);
    const wrapper = await mountShell();
    const roomy: boolean[] = [];

    for (const index of [0, 1, 2, 3]) {
      await selectTab(wrapper, index);
      roomy.push(wrapper.get('main').classes().includes('app-shell__main--roomy'));
    }

    expect(roomy).toEqual([false, false, true, true]);
  });
});
