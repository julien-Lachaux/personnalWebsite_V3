import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, type ComputedRef } from 'vue';
import { clearNuxtState, useRouter } from '#imports';

import { UNINDEXED_PATH_STATE_KEY, useIndexedPage, useUnindexedPage } from './useSeo.js';

// Page hors index (lot 31) : la page se déclare (`useUnindexedPage`, `noindex`) et la racine le lit
// (`useIndexedPage`) pour ne poser ni canonique ni hreflang ; la déclaration ne vaut que pour le chemin
// de la page qui l'a faite.

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  clearNuxtState(UNINDEXED_PATH_STATE_KEY);
});

async function flushHead(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function robots(): string | null {
  return document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;
}

let indexed: ComputedRef<boolean> | undefined;

/** Racine qui lit l'état (comme app.vue), avec ou sans page hors index. */
function root(unindexed: boolean) {
  return defineComponent({
    setup() {
      indexed = useIndexedPage();
      if (unindexed) useUnindexedPage();
      return () => h('p', 'page');
    },
  });
}

async function mount(unindexed: boolean, route: string): Promise<ComputedRef<boolean>> {
  mounted.push(await mountSuspended(root(unindexed), { route }));
  await flushHead();
  return indexed!;
}

describe('useIndexedPage et useUnindexedPage', () => {
  it('une page est indexée tant qu’elle ne se déclare pas hors index, sans méta robots', async () => {
    const state = await mount(false, '/accessibilite');

    expect(state.value).toBe(true);
    expect(robots()).toBeNull();
  });

  it('la page qui se déclare hors index pose noindex et n’est plus indexée', async () => {
    const state = await mount(true, '/travaux');

    expect(state.value).toBe(false);
    expect(robots()).toBe('noindex');
  });

  it('la déclaration ne vaut que pour son chemin : une autre page redevient indexée', async () => {
    const state = await mount(true, '/travaux');
    expect(state.value).toBe(false);

    await useRouter().push('/accessibilite');
    await flushHead();

    expect(state.value).toBe(true);
  });
});
