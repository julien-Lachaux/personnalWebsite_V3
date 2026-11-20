import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtState } from '#imports';

import App from './app.vue';
import { PREFERENCES_STATE_KEY } from './composables/shell/usePreferences.js';

// Racine (F3a) : lien d'évitement en premier élément focalisable, vers le contenu principal ;
// préférences branchées une fois (attributs de <html> posés au montage, comme le script de thème).

const mounted: VueWrapper[] = [];

beforeEach(() => {
  clearNuxtState(PREFERENCES_STATE_KEY);
  localStorage.clear();
  for (const name of ['data-theme', 'data-text-size', 'data-motion']) {
    document.documentElement.removeAttribute(name);
  }
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === '(prefers-color-scheme: dark)',
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
});

async function mountApp(route: string): Promise<VueWrapper> {
  const wrapper = await mountSuspended(App, { route, attachTo: document.body });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
}

describe('app.vue : lien d’évitement et préférences', () => {
  it('commence par « Aller au contenu », vers #contenu', async () => {
    const wrapper = await mountApp('/');

    const first = wrapper.find('a, button');
    expect(first.classes()).toContain('skip-link');
    expect(first.attributes('href')).toBe('#contenu');
    expect(first.text()).toBe('Aller au contenu');
  });

  it('se traduit en anglais', async () => {
    const wrapper = await mountApp('/en');

    expect(wrapper.get('.skip-link').text()).toBe('Skip to content');
  });

  it('pose les attributs de <html> au montage (système sombre, rien d’enregistré)', async () => {
    await mountApp('/');

    expect(document.documentElement.getAttribute('data-theme')).toBe('sombre');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('100');
    expect(document.documentElement.getAttribute('data-motion')).toBe('normal');
  });
});
