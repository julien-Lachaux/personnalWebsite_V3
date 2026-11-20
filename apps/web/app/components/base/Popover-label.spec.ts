import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import Popover, { type PopoverTriggerProps } from './Popover.vue';

// D18 : le nom accessible du panneau peut différer du titre visible (le nom de
// fichier) : `label` pose `aria-label` et retire `aria-labelledby`, qui l'emporterait dans le calcul
// du nom. Sans `label`, le titre nomme toujours le panneau. Typage du slot `trigger`.

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
});

function popoverPage(label: string | undefined) {
  return defineComponent({
    setup() {
      const open = ref(false);
      return () =>
        h(
          Popover,
          {
            open: open.value,
            'onUpdate:open': (value: boolean) => (open.value = value),
            title: 'accessibilite.cfg',
            closeLabel: 'Fermer',
            label,
          },
          {
            trigger: ({ props }: { props: PopoverTriggerProps }) =>
              h('button', { id: 'trigger', type: 'button', 'aria-label': 'Ouvrir', ...props }),
            default: () => [h('button', { type: 'button' }, 'Réglage')],
          },
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

describe('Popover : nom accessible (D18)', () => {
  it('avec label : aria-label, sans aria-labelledby, le titre reste visible', async () => {
    await mount(popoverPage('Réglages d’accessibilité'));

    expect(dialog().getAttribute('aria-label')).toBe('Réglages d’accessibilité');
    expect(dialog().hasAttribute('aria-labelledby')).toBe(false);
    expect(dialog().querySelector('h2')?.textContent).toBe('accessibilite.cfg');
  });

  it('sans label : nommé par son titre', async () => {
    await mount(popoverPage(undefined));

    expect(dialog().hasAttribute('aria-label')).toBe(false);
    const title = document.getElementById(dialog().getAttribute('aria-labelledby') ?? '');
    expect(title?.textContent).toBe('accessibilite.cfg');
  });

  it('donne au déclencheur des valeurs ARIA littérales', async () => {
    const wrapper = await mount(popoverPage(undefined));
    const trigger = wrapper.get('#trigger');

    expect(trigger.attributes()).toMatchObject({
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      'aria-controls': dialog().id,
    });
    await trigger.trigger('click');
    expect(trigger.attributes('aria-expanded')).toBe('true');
    expectTypeOf<PopoverTriggerProps['aria-expanded']>().toEqualTypeOf<'true' | 'false'>();
    expectTypeOf<PopoverTriggerProps['aria-haspopup']>().toEqualTypeOf<'dialog'>();
  });
});
