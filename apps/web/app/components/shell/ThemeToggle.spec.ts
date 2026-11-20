import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtState } from '#imports';

import { usePreferences, PREFERENCES_STATE_KEY } from '../../composables/shell/usePreferences.js';
import { PREFERENCES_STORAGE_KEY } from '../../domain/preferences.js';
import ThemeToggle from './ThemeToggle.vue';

const mounted: VueWrapper[] = [];

async function mountToggle(route = '/'): Promise<VueWrapper> {
  const wrapper = await mountSuspended(ThemeToggle, { route });
  mounted.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  clearNuxtState(PREFERENCES_STATE_KEY);
  window.localStorage.clear();
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

describe('ThemeToggle', () => {
  it('est un vrai bouton dont le nom annonce le thème sombre et l’action (français)', async () => {
    const wrapper = await mountToggle();

    const button = wrapper.get('button');
    expect(button.attributes('type')).toBe('button');
    expect(button.attributes('aria-label')).toBe('Thème sombre, passer en thème clair');
  });

  it('annonce le thème clair quand il est actif', async () => {
    const wrapper = await mountToggle();
    usePreferences().set('theme', 'clair');
    await nextTick();

    expect(wrapper.get('button').attributes('aria-label')).toBe(
      'Thème clair, passer en thème sombre',
    );
  });

  it('parle anglais sur la page anglaise', async () => {
    const wrapper = await mountToggle('/en');
    expect(wrapper.get('button').attributes('aria-label')).toBe(
      'Dark theme, switch to light theme',
    );

    usePreferences().set('theme', 'clair');
    await nextTick();
    expect(wrapper.get('button').attributes('aria-label')).toBe(
      'Light theme, switch to dark theme',
    );
  });

  it('bascule le thème au clic, dans les deux sens, et le mémorise', async () => {
    const wrapper = await mountToggle();
    const { preferences } = usePreferences();

    await wrapper.get('button').trigger('click');
    expect(preferences.value.theme).toBe('clair');
    expect(JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}')).toMatchObject({
      theme: 'clair',
    });
    expect(wrapper.get('button').attributes('aria-label')).toBe(
      'Thème clair, passer en thème sombre',
    );

    await wrapper.get('button').trigger('click');
    expect(preferences.value.theme).toBe('sombre');
    expect(wrapper.get('button').attributes('aria-label')).toBe(
      'Thème sombre, passer en thème clair',
    );
  });

  it('cache l’icône aux lecteurs d’écran : le nom vient du bouton', async () => {
    const wrapper = await mountToggle();

    expect(wrapper.get('button svg').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('button').text()).toBe('');
  });
});
