import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';

import Popover from './Popover.vue';

// Constat RA-5 (WCAG 2.4.11) : le panneau, fixe et non modal, restait ouvert (et masquait le focus de la
// page) quand Tab sortait de sa racine. Il se ferme quand le focus passe hors de la racine, sans reprendre
// le focus ; Échap reste fonctionnel.

const mounted: VueWrapper[] = [];

const Page = defineComponent({
  props: { startOpen: { type: Boolean, default: true } },
  setup(props) {
    const open = ref(props.startOpen);
    return () =>
      h('div', [
        h(
          Popover,
          {
            open: open.value,
            'onUpdate:open': (value: boolean) => (open.value = value),
            title: 'accessibilite.cfg',
            closeLabel: 'Fermer',
          },
          {
            trigger: ({ props: trigger }: { props: Record<string, unknown> }) =>
              h('button', { id: 'trigger', type: 'button', 'aria-label': 'Options', ...trigger }),
            default: () => [h('button', { id: 'inside', type: 'button' }, 'Réglage')],
          },
        ),
        h('button', { id: 'outside', type: 'button' }, 'Dehors'),
      ]);
  },
});

async function setup(startOpen = true): Promise<VueWrapper> {
  const wrapper = await mountSuspended(Page, { props: { startOpen }, attachTo: document.body });
  mounted.push(wrapper);
  return wrapper;
}

/** Le focus quitte `from` pour `to` (`null` : il sort de la page) : `focusout` remonte à la racine. */
function focusLeaves(wrapper: VueWrapper, from: string, to: string | null): void {
  const target = wrapper.find<HTMLElement>(from).element;
  const next = to === null ? null : wrapper.find<HTMLElement>(to).element;
  target.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: next }));
}

function panelHidden(wrapper: VueWrapper): boolean {
  return wrapper.find<HTMLElement>('[role="dialog"]').element.hasAttribute('hidden');
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

describe('Popover : sortie du focus', () => {
  it('se ferme quand le focus passe hors de la racine', async () => {
    const wrapper = await setup();
    expect(panelHidden(wrapper)).toBe(false);

    focusLeaves(wrapper, '#inside', '#outside');
    await wrapper.vm.$nextTick();

    expect(panelHidden(wrapper)).toBe(true);
  });

  it('ne reprend pas le focus en se fermant', async () => {
    const wrapper = await setup();
    const outside = wrapper.find<HTMLElement>('#outside').element;
    outside.focus();

    focusLeaves(wrapper, '#inside', '#outside');
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(outside);
  });

  it('reste ouvert quand le focus passe d’un élément du panneau à un autre', async () => {
    const wrapper = await setup();

    focusLeaves(wrapper, '#inside', '#trigger');
    await wrapper.vm.$nextTick();

    expect(panelHidden(wrapper)).toBe(false);
  });

  it('reste ouvert quand le focus sort de la page (aucune cible)', async () => {
    const wrapper = await setup();

    focusLeaves(wrapper, '#inside', null);
    await wrapper.vm.$nextTick();

    expect(panelHidden(wrapper)).toBe(false);
  });

  it('reste fermé et ne notifie rien quand le focus quitte le déclencheur panneau fermé', async () => {
    const wrapper = await setup(false);

    focusLeaves(wrapper, '#trigger', '#outside');
    await wrapper.vm.$nextTick();

    expect(panelHidden(wrapper)).toBe(true);
    expect(wrapper.findComponent(Popover).emitted('update:open')).toBeUndefined();
  });

  it('Échap ferme toujours le panneau et rend le focus au déclencheur', async () => {
    const wrapper = await setup();
    wrapper.find<HTMLElement>('#inside').element.focus();

    await wrapper.find('#inside').trigger('keydown', { key: 'Escape' });
    await wrapper.vm.$nextTick();

    expect(panelHidden(wrapper)).toBe(true);
    expect(document.activeElement).toBe(wrapper.find<HTMLElement>('#trigger').element);
  });
});
