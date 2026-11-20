import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';

import Window from './Window.vue';

// D18 : le nom accessible d'une fenêtre peut différer du titre visible (le nom de
// fichier) : `label` pose `aria-label` et retire `aria-labelledby`, qui l'emporterait dans le calcul
// du nom. Sans `label`, le titre nomme toujours la fenêtre.

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
});

function windowPage(label: string | undefined) {
  return defineComponent({
    setup() {
      return () =>
        h(
          Window,
          { open: true, title: 'contact.sh', closeLabel: 'Fermer', label },
          { default: () => [h('p', 'Corps')] },
        );
    },
  });
}

async function mount(component: ReturnType<typeof defineComponent>): Promise<VueWrapper> {
  const wrapper = await mountSuspended(component, { attachTo: document.body });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
}

function dialog(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[role="dialog"]');
  if (element === null) throw new Error('aucune fenêtre');
  return element;
}

describe('Window : nom accessible (D18)', () => {
  it('avec label : aria-label, sans aria-labelledby, le titre reste visible', async () => {
    await mount(windowPage('Me contacter'));

    expect(dialog().getAttribute('aria-label')).toBe('Me contacter');
    expect(dialog().hasAttribute('aria-labelledby')).toBe(false);
    expect(dialog().querySelector('.window__title')?.textContent).toBe('contact.sh');
  });

  it('sans label : nommée par son titre', async () => {
    await mount(windowPage(undefined));

    expect(dialog().hasAttribute('aria-label')).toBe(false);
    const title = document.getElementById(dialog().getAttribute('aria-labelledby') ?? '');
    expect(title?.textContent).toBe('contact.sh');
  });
});
