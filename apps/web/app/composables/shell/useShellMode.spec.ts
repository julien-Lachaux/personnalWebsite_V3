import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent, h, nextTick } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { MOSAIC_QUERY, useShellMode } from './useShellMode.js';

class FakeMedia {
  readonly listeners = new Set<() => void>();
  constructor(public matches: boolean) {}
  addEventListener(type: string, listener: () => void): void {
    expect(type).toBe('change');
    this.listeners.add(listener);
  }
  removeEventListener(type: string, listener: () => void): void {
    expect(type).toBe('change');
    this.listeners.delete(listener);
  }
  change(matches: boolean): void {
    this.matches = matches;
    for (const listener of [...this.listeners]) listener();
  }
}

function install(matches: boolean): { media: FakeMedia; queries: string[] } {
  const media = new FakeMedia(matches);
  const queries: string[] = [];
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    queries.push(query);
    return media as unknown as MediaQueryList;
  });
  return { media, queries };
}

const Probe = defineComponent({
  setup() {
    const mode = useShellMode();
    return () => h('p', String(mode.value));
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useShellMode', () => {
  it('suit le seuil de la mosaïque (1024 px, celui de computeLayout)', () => {
    expect(MOSAIC_QUERY).toBe('(min-width: 1024px)');
  });

  it('vaut « tabs » sous 1024 px une fois monté', async () => {
    const { queries } = install(false);
    const wrapper = await mountSuspended(Probe);

    expect(wrapper.text()).toBe('tabs');
    expect(queries).toEqual([MOSAIC_QUERY]);
  });

  it('vaut « mosaic » à partir de 1024 px et suit les changements de largeur', async () => {
    const { media } = install(true);
    const wrapper = await mountSuspended(Probe);
    expect(wrapper.text()).toBe('mosaic');

    media.change(false);
    await nextTick();
    expect(wrapper.text()).toBe('tabs');
  });

  it('retire son écouteur au démontage', async () => {
    const { media } = install(true);
    const wrapper = await mountSuspended(Probe);
    expect(media.listeners.size).toBe(1);

    wrapper.unmount();

    expect(media.listeners.size).toBe(0);
  });

  it('vaut null au rendu statique, sans lire la largeur', async () => {
    const spy = vi.spyOn(window, 'matchMedia');

    const html = await renderToString(createSSRApp(Probe));

    expect(html).toBe('<p>null</p>');
    expect(spy).not.toHaveBeenCalled();
  });
});
