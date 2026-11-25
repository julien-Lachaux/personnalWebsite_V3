import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import AccessibilityPanel from './AccessibilityPanel.vue';

// D18 : le panneau s'annonce « Réglages d'accessibilité » (nom accessible), le nom de fichier
// `accessibilite.cfg` restant son titre visible.

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

async function mountPanel(route: string): Promise<VueWrapper> {
  const wrapper = await mountSuspended(AccessibilityPanel, {
    route,
    attachTo: document.body,
    props: { declarationUrl: '/accessibilite' },
  });
  mounted.push(wrapper);
  await wrapper.get('button[aria-haspopup="dialog"]').trigger('click');
  await nextTick();
  return wrapper;
}

describe('AccessibilityPanel : nom accessible (D18)', () => {
  it('se nomme « Réglages d’accessibilité », titre visible accessibilite.cfg', async () => {
    const wrapper = await mountPanel('/');

    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes('aria-label')).toBe('Réglages d’accessibilité');
    expect(dialog.attributes('aria-labelledby')).toBeUndefined();
    expect(dialog.get('h2').text()).toBe('accessibilite.cfg');
  });

  it('se nomme « Accessibility settings » en anglais', async () => {
    const wrapper = await mountPanel('/en');

    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Accessibility settings');
  });
});
