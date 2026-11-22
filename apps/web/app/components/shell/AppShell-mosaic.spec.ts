import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';
import { useRuntimeConfig } from '#imports';

import { MOSAIC_QUERY } from '../../composables/shell/useShellMode.js';
import AppShell from './AppShell.vue';

// Coquille au bureau (lot F6) : les sections dans les tuiles de la mosaïque, agrandir et réduire par le
// bouton d'une tuile ou par la barre du haut, focus. La largeur est simulée par `matchMedia`.

const PLACEHOLDER = 'contact@example.org';
const SECTIONS = ['profile', 'experience', 'recommendations', 'ai'] as const;

let original = '';
const mounted: VueWrapper[] = [];

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

async function mountShell(): Promise<VueWrapper> {
  const wrapper = await mountSuspended(AppShell, {
    attachTo: document.body,
    props: {
      heading: 'Développeur full-stack',
      cvPath: '/cv/exemple.pdf',
      declarationUrl: '/a11y',
    },
    slots: Object.fromEntries(
      SECTIONS.map((id) => [id, () => h('a', { href: `#${id}` }, `contenu ${id}`)]),
    ),
  });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
}

function topTabs(wrapper: VueWrapper) {
  return wrapper.findAll('.top-bar__nav button');
}

beforeEach(() => {
  original = useRuntimeConfig().public.contactEmail;
  useRuntimeConfig().public.contactEmail = PLACEHOLDER;
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  width(true);
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  useRuntimeConfig().public.contactEmail = original;
  vi.restoreAllMocks();
});

describe('AppShell : mosaïque', () => {
  it('chaque section dans sa tuile : contenu focalisable, h2 masqué visuellement, slot', async () => {
    const wrapper = await mountShell();

    expect(wrapper.find('.tile-grid').exists()).toBe(true);
    expect(wrapper.find('.app-shell__sections').exists()).toBe(false);
    for (const id of SECTIONS) {
      const content = wrapper.get(`[data-tile="${id}"] #section-${id}`);
      expect(content.attributes('tabindex')).toBe('-1');
      expect(content.get('h2').classes()).toContain('visually-hidden');
      expect(content.get('h2').attributes('id')).toBe(`titre-${id}`);
      expect(content.text()).toContain(`contenu ${id}`);
    }
  });

  it('le bouton d’une tuile l’agrandit (onglet courant de la barre du haut) puis la réduit ; le focus reste sur le bouton', async () => {
    const wrapper = await mountShell();
    const button = wrapper.get('[data-tile="ai"] .tile__toggle');
    (button.element as HTMLElement).focus();

    await button.trigger('click');
    expect(topTabs(wrapper)[4]!.attributes('aria-current')).toBe('true');
    expect(topTabs(wrapper)[0]!.attributes('aria-current')).toBeUndefined();
    expect(wrapper.get('[data-tile="ai"]').classes()).toContain('tile-grid__tile--expanded');
    expect(button.attributes('aria-label')).toBe('Réduire IA');
    expect(document.activeElement).toBe(button.element);

    await button.trigger('click');
    expect(topTabs(wrapper)[0]!.attributes('aria-current')).toBe('true');
    expect(wrapper.find('.tile-grid__tile--expanded').exists()).toBe(false);
    expect(document.activeElement).toBe(button.element);
  });

  it('agrandir une autre tuile remplace la tuile agrandie', async () => {
    const wrapper = await mountShell();

    await wrapper.get('[data-tile="ai"] .tile__toggle').trigger('click');
    await wrapper.get('[data-tile="profile"] .tile__toggle').trigger('click');

    expect(
      wrapper.findAll('.tile-grid__tile--expanded').map((tile) => tile.attributes('data-tile')),
    ).toEqual(['profile']);
  });

  it('onglet de la barre du haut : agrandit la tuile, focus sur son contenu sans défilement', async () => {
    const wrapper = await mountShell();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');

    await topTabs(wrapper)[3]!.trigger('click');
    await nextTick();

    const content = wrapper.get('#section-recommendations');
    expect(document.activeElement).toBe(content.element);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(wrapper.get('[data-tile="recommendations"]').classes()).toContain(
      'tile-grid__tile--expanded',
    );

    await topTabs(wrapper)[0]!.trigger('click');
    expect(wrapper.find('.tile-grid__tile--expanded').exists()).toBe(false);
  });

  it('retour sous 1024 px : les sections reprennent leur place d’onglet', async () => {
    let listener: () => void = () => undefined;
    let matches = true;
    vi.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          get matches() {
            return matches;
          },
          addEventListener: (_type: string, callback: () => void) => {
            listener = callback;
          },
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    const wrapper = await mountShell();
    expect(wrapper.find('.tile-grid').exists()).toBe(true);

    matches = false;
    listener();
    await nextTick();

    expect(wrapper.find('.tile-grid').exists()).toBe(false);
    expect(wrapper.get('section#section-profile').attributes('aria-labelledby')).toBe(
      'titre-profile',
    );
  });
});
