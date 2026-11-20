import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref, type PropType } from 'vue';

import Popover from './Popover.vue';

const mounted: VueWrapper[] = [];
const hosts: HTMLElement[] = [];

/** Page de test : un bouton déclencheur dans le slot, un bouton extérieur et le panneau de réglages. */
const Page = defineComponent({
  props: {
    startOpen: { type: Boolean, default: false },
    closeLabel: { type: String, default: 'Fermer les options d’accessibilité' },
    body: {
      type: String as PropType<'settings' | 'text' | 'autofocus' | 'skipped'>,
      default: 'settings',
    },
  },
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
            closeLabel: props.closeLabel,
          },
          {
            trigger: ({ props: trigger }: { props: Record<string, unknown> }) =>
              h('button', {
                id: 'trigger',
                type: 'button',
                'aria-label': 'Options d’accessibilité',
                ...trigger,
              }),
            default: () => {
              if (props.body === 'text') return [h('p', 'Réglages mémorisés sur cet appareil.')];
              if (props.body === 'autofocus') {
                return [
                  h('button', { id: 'first', type: 'button' }, 'A'),
                  h('button', { id: 'wanted', type: 'button', autofocus: true }, 'B'),
                ];
              }
              if (props.body === 'skipped') {
                return [
                  h('button', { id: 'off', type: 'button', disabled: true }, 'Désactivé'),
                  h('div', { inert: true }, [
                    h('button', { id: 'inert', type: 'button' }, 'Inerte'),
                  ]),
                  h('div', { hidden: true }, [h('button', { id: 'hid', type: 'button' }, 'Caché')]),
                  h('a', { id: 'link', href: '#declaration' }, 'Déclaration'),
                ];
              }
              return [
                h(
                  'button',
                  { id: 'first', type: 'button', role: 'switch', 'aria-checked': 'false' },
                  'Contraste',
                ),
                h('button', { id: 'last', type: 'button' }, 'Réinitialiser'),
              ];
            },
          },
        ),
        h('button', { id: 'other', type: 'button' }, 'Autre'),
      ]);
  },
});

async function mountPage(props: Record<string, unknown> = {}): Promise<VueWrapper> {
  const host = document.createElement('div');
  document.body.append(host);
  hosts.push(host);
  const wrapper = await mountSuspended(Page, { props, attachTo: host });
  mounted.push(wrapper);
  return wrapper;
}

const byId = (id: string): HTMLElement => document.getElementById(id)!;
const panel = (): HTMLElement => document.querySelector('.popover__panel')!;
const closeButtonOf = (): HTMLElement => document.querySelector('.popover__close')!;
const pressKey = (target: HTMLElement, key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
});

describe('Popover', () => {
  it('fermé : panneau caché mais présent, déclencheur aria-expanded false et aria-controls vers le panneau', async () => {
    await mountPage();

    const trigger = byId('trigger');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-controls')).toBe(panel().id);
    expect(panel().id).toBeTruthy();
    expect(panel().hasAttribute('hidden')).toBe(true);
  });

  it('le panneau est un dialogue non modal nommé par son titre `>_ fichier`, avec un bouton × nommé', async () => {
    await mountPage();

    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-modal')).toBe('false');
    const title = byId(panel().getAttribute('aria-labelledby')!);
    expect(title.tagName).toBe('H2');
    expect(title.textContent).toBe('accessibilite.cfg');
    expect(panel().querySelector('.popover__prompt')?.getAttribute('aria-hidden')).toBe('true');
    const close = panel().querySelector('.popover__close')!;
    expect(close.getAttribute('aria-label')).toBe('Fermer les options d’accessibilité');
    expect(close.querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
  });

  it.each([
    ['fr', 'Fermer les options d’accessibilité'],
    ['en', 'Close the accessibility options'],
  ])('le nom du bouton × (%s) est le libellé fourni', async (_language, closeLabel) => {
    await mountPage({ closeLabel });

    expect(panel().querySelector('.popover__close')?.getAttribute('aria-label')).toBe(closeLabel);
  });

  it('un clic sur le déclencheur ouvre : aria-expanded true, panneau visible, focus sur le premier réglage', async () => {
    await mountPage();

    byId('trigger').click();
    await nextTick();
    await nextTick();

    expect(byId('trigger').getAttribute('aria-expanded')).toBe('true');
    expect(panel().hasAttribute('hidden')).toBe(false);
    expect(document.activeElement).toBe(byId('first'));
  });

  it('un second clic sur le déclencheur referme', async () => {
    await mountPage();

    byId('trigger').click();
    await nextTick();
    byId('trigger').click();
    await nextTick();

    expect(byId('trigger').getAttribute('aria-expanded')).toBe('false');
    expect(panel().hasAttribute('hidden')).toBe(true);
  });

  it('met le focus sur l’élément marqué autofocus plutôt que sur le premier', async () => {
    await mountPage({ body: 'autofocus' });

    byId('trigger').click();
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(byId('wanted'));
  });

  it('ignore les éléments désactivés, inertes ou cachés pour le focus initial', async () => {
    await mountPage({ body: 'skipped' });

    byId('trigger').click();
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(byId('link'));
  });

  it('sans élément focalisable dans le panneau, le focus va sur le bouton ×', async () => {
    await mountPage({ body: 'text' });

    byId('trigger').click();
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(panel().querySelector('.popover__close'));
  });

  it('le bouton × ferme et rend le focus au déclencheur', async () => {
    await mountPage();
    byId('trigger').click();
    await nextTick();
    await nextTick();

    closeButtonOf().click();
    await nextTick();
    await nextTick();

    expect(byId('trigger').getAttribute('aria-expanded')).toBe('false');
    expect(panel().hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(byId('trigger'));
  });

  it('Échap dans le panneau ferme et rend le focus au déclencheur', async () => {
    await mountPage();
    byId('trigger').click();
    await nextTick();
    await nextTick();

    const escape = pressKey(byId('last'), 'Escape');
    await nextTick();
    await nextTick();

    expect(escape.defaultPrevented).toBe(true);
    expect(panel().hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(byId('trigger'));
  });

  it('Échap sur le déclencheur ferme aussi le panneau ouvert', async () => {
    await mountPage();
    byId('trigger').click();
    await nextTick();
    byId('trigger').focus();

    pressKey(byId('trigger'), 'Escape');
    await nextTick();

    expect(byId('trigger').getAttribute('aria-expanded')).toBe('false');
  });

  it('Échap alors que le panneau est fermé, ou une autre touche, ne fait rien', async () => {
    await mountPage();

    expect(pressKey(byId('trigger'), 'Escape').defaultPrevented).toBe(false);

    byId('trigger').click();
    await nextTick();
    expect(pressKey(byId('last'), 'a').defaultPrevented).toBe(false);
    expect(byId('trigger').getAttribute('aria-expanded')).toBe('true');
  });

  it('non modal : reste ouvert quand le focus sort, sans piège de focus ni voile', async () => {
    await mountPage();
    byId('trigger').click();
    await nextTick();
    await nextTick();

    byId('other').focus();
    expect(pressKey(byId('other'), 'Tab').defaultPrevented).toBe(false);
    await nextTick();

    expect(panel().hasAttribute('hidden')).toBe(false);
    expect(document.activeElement).toBe(byId('other'));
    expect(document.querySelector('.window-layer, .window-layer__scrim')).toBeNull();
  });

  it('ouvert dès le montage : aria-expanded true et panneau visible', async () => {
    await mountPage({ startOpen: true });

    expect(byId('trigger').getAttribute('aria-expanded')).toBe('true');
    expect(panel().hasAttribute('hidden')).toBe(false);
  });
});
