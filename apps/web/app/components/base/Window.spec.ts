import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref, type PropType, type VNode } from 'vue';

import Window from './Window.vue';

const mounted: VueWrapper[] = [];
const hosts: HTMLElement[] = [];

/** Page de test : un déclencheur, un bouton extérieur et une fenêtre de formulaire. */
const Page = defineComponent({
  props: {
    startOpen: { type: Boolean, default: false },
    closeOnScrim: { type: Boolean, default: true },
    tone: { type: String as PropType<'accent' | 'neon'>, default: 'accent' },
    closeLabel: { type: String, default: 'Fermer le formulaire' },
    body: {
      type: String as PropType<'form' | 'text' | 'hidden-first' | 'autofocus'>,
      default: 'form',
    },
    returnToOther: { type: Boolean, default: false },
  },
  setup(props) {
    const open = ref(props.startOpen);
    return () =>
      h('div', [
        h('button', { id: 'opener', type: 'button', onClick: () => (open.value = true) }, 'Ouvrir'),
        h('button', { id: 'other', type: 'button' }, 'Autre'),
        h(
          Window,
          {
            open: open.value,
            'onUpdate:open': (value: boolean) => (open.value = value),
            title: 'contact.sh',
            closeLabel: props.closeLabel,
            tone: props.tone,
            closeOnScrim: props.closeOnScrim,
            returnFocusTo: props.returnToOther ? document.getElementById('other') : undefined,
          },
          {
            default: () => {
              if (props.body === 'text') return [h('p', { id: 'text' }, 'Un message suffit.')];
              if (props.body === 'hidden-first') {
                return [
                  h('button', { id: 'off', type: 'button', disabled: true }, 'Désactivé'),
                  h('div', { inert: true }, [
                    h('button', { id: 'inert', type: 'button' }, 'Inerte'),
                  ]),
                  h('div', { hidden: true }, [h('button', { id: 'hid', type: 'button' }, 'Caché')]),
                  h('button', { id: 'minus', type: 'button', tabindex: -1 }, 'Hors tabulation'),
                  h('div', { 'aria-hidden': 'true' }, [
                    h('button', { id: 'masked', type: 'button' }, 'Masqué'),
                  ]),
                  h('input', { id: 'real', type: 'hidden' }),
                  h('a', { id: 'link', href: '#x' }, 'Lien'),
                ];
              }
              if (props.body === 'autofocus') {
                return [
                  h('input', { id: 'name' }),
                  h('textarea', { id: 'message', 'data-autofocus': '' }),
                ];
              }
              return [
                h('input', { id: 'name', type: 'text', 'aria-label': 'nom' }),
                h('button', { id: 'send', type: 'button' }, 'Envoyer'),
              ];
            },
          },
        ),
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

const dialog = (): HTMLElement | null => document.body.querySelector('[role="dialog"]');
const closeButtonOf = (): HTMLElement => document.body.querySelector('.window__close')!;
const byId = (id: string): HTMLElement => document.getElementById(id)!;
const pressKey = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
};

async function open(): Promise<void> {
  byId('opener').focus();
  byId('opener').click();
  await nextTick();
  await nextTick();
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
  document.body.removeAttribute('style');
  document.body.removeAttribute('data-window-locks');
  document.body.removeAttribute('data-window-overflow');
});

describe('Window', () => {
  it('fermée : rien dans la page, aucun verrou de défilement', async () => {
    await mountPage();

    expect(dialog()).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('ouverte : dialogue modal nommé par son titre `>_ fichier`, bouton × nommé, corps en slot', async () => {
    await mountPage();
    await open();

    const element = dialog()!;
    expect(element.getAttribute('aria-modal')).toBe('true');
    const title = byId(element.getAttribute('aria-labelledby')!);
    expect(title.textContent).toBe('contact.sh');
    expect(element.querySelector('.window__prompt')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.window__prompt')?.textContent).toBe('>_');
    const close = element.querySelector('.window__close')!;
    expect(close.tagName).toBe('BUTTON');
    expect(close.getAttribute('aria-label')).toBe('Fermer le formulaire');
    expect(close.querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.contains(byId('name'))).toBe(true);
    expect(element.classList.contains('window--accent')).toBe(true);
  });

  it('est rendue dans <body>, hors du composant qui l’appelle (Teleport)', async () => {
    const wrapper = await mountPage();
    await open();

    expect((wrapper.element as Element).contains(dialog())).toBe(false);
    expect(dialog()?.closest('.window-layer')?.parentElement).toBe(document.body);
  });

  it.each([
    ['fr', 'Fermer le formulaire'],
    ['en', 'Close the form'],
  ])('le nom du bouton × (%s) est le libellé fourni', async (_language, closeLabel) => {
    await mountPage({ closeLabel });
    await open();

    expect(dialog()?.querySelector('.window__close')?.getAttribute('aria-label')).toBe(closeLabel);
  });

  it('applique le ton néon', async () => {
    await mountPage({ tone: 'neon' });
    await open();

    expect(dialog()?.classList.contains('window--neon')).toBe(true);
    expect(dialog()?.classList.contains('window--accent')).toBe(false);
  });

  it('met le focus sur le premier élément focalisable du corps, pas sur le ×', async () => {
    await mountPage();
    await open();

    expect(document.activeElement).toBe(byId('name'));
  });

  it('met le focus sur l’élément marqué data-autofocus', async () => {
    await mountPage({ body: 'autofocus' });
    await open();

    expect(document.activeElement).toBe(byId('message'));
  });

  it('ignore les éléments désactivés, inertes, cachés, masqués (aria-hidden), hors tabulation ou de type hidden', async () => {
    await mountPage({ body: 'hidden-first' });
    await open();

    expect(document.activeElement).toBe(byId('link'));
  });

  it('sans élément focalisable dans le corps, le focus va sur le bouton ×', async () => {
    await mountPage({ body: 'text' });
    await open();

    expect(document.activeElement).toBe(dialog()?.querySelector('.window__close'));
  });

  it('Tab depuis le dernier élément revient au premier (le ×), Maj+Tab depuis le premier va au dernier', async () => {
    await mountPage();
    await open();
    const close = closeButtonOf();

    byId('send').focus();
    const forward = pressKey('Tab');
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);

    const backward = pressKey('Tab', { shiftKey: true });
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('send'));
  });

  it('Tab ou Maj+Tab au milieu ne sont pas interceptés (le navigateur avance)', async () => {
    await mountPage();
    await open();

    byId('name').focus();

    expect(pressKey('Tab').defaultPrevented).toBe(false);
    expect(pressKey('Tab', { shiftKey: true }).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(byId('name'));
  });

  it('si le focus est hors de la fenêtre, Tab le ramène au premier élément et Maj+Tab au dernier', async () => {
    await mountPage();
    await open();

    byId('other').focus();
    expect(pressKey('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog()?.querySelector('.window__close'));

    byId('other').focus();
    expect(pressKey('Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('send'));
  });

  it('les autres touches ne sont pas interceptées', async () => {
    await mountPage();
    await open();

    expect(pressKey('a').defaultPrevented).toBe(false);
    expect(pressKey('Enter').defaultPrevented).toBe(false);
    expect(dialog()).not.toBeNull();
  });

  it('Échap ferme la fenêtre et rend le focus au déclencheur', async () => {
    const wrapper = await mountPage();
    await open();

    const escape = pressKey('Escape');
    await nextTick();
    await nextTick();

    expect(escape.defaultPrevented).toBe(true);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(byId('opener'));
    expect(wrapper.findComponent(Window).emitted('update:open')?.at(-1)).toEqual([false]);
  });

  it('Échap fonctionne aussi quand le focus est sur le corps de la page', async () => {
    await mountPage({ body: 'text' });
    await open();
    (document.activeElement as HTMLElement).blur();

    pressKey('Escape');
    await nextTick();

    expect(dialog()).toBeNull();
  });

  it('le bouton × ferme et rend le focus au déclencheur', async () => {
    await mountPage();
    await open();

    closeButtonOf().click();
    await nextTick();
    await nextTick();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(byId('opener'));
  });

  it('le voile est cliquable : il ferme, sans être dans la tabulation ni lu', async () => {
    await mountPage();
    await open();

    const scrim = document.body.querySelector<HTMLElement>('.window-layer__scrim')!;
    expect(scrim.tagName).toBe('BUTTON');
    expect(scrim.getAttribute('tabindex')).toBe('-1');
    expect(scrim.getAttribute('aria-hidden')).toBe('true');
    scrim.click();
    await nextTick();
    await nextTick();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(byId('opener'));
  });

  it('closeOnScrim false : le voile n’est plus un bouton et un clic dessus ne ferme pas', async () => {
    await mountPage({ closeOnScrim: false });
    await open();

    const scrim = document.body.querySelector<HTMLElement>('.window-layer__scrim')!;
    expect(scrim.tagName).toBe('DIV');
    expect(scrim.getAttribute('aria-hidden')).toBe('true');
    scrim.click();
    await nextTick();

    expect(dialog()).not.toBeNull();
    pressKey('Escape');
    await nextTick();
    expect(dialog()).toBeNull();
  });

  it('rend le focus à returnFocusTo plutôt qu’au déclencheur', async () => {
    await mountPage({ returnToOther: true });
    // returnFocusTo lit le bouton « Autre » au rendu : il existe après le premier rendu.
    await nextTick();
    await open();

    pressKey('Escape');
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(byId('other'));
  });

  it('bloque le défilement de la page tant qu’elle est ouverte, puis rétablit la valeur d’origine', async () => {
    document.body.style.overflow = 'scroll';
    await mountPage();

    await open();
    expect(document.body.style.overflow).toBe('hidden');

    pressKey('Escape');
    await nextTick();
    expect(document.body.style.overflow).toBe('scroll');
    expect(document.body.dataset['windowLocks']).toBeUndefined();
    expect(document.body.dataset['windowOverflow']).toBeUndefined();
  });

  it('deux fenêtres ouvertes : la page reste bloquée jusqu’à la fermeture de la dernière, dans n’importe quel ordre', async () => {
    const first = ref(true);
    const second = ref(true);
    const Both = {
      render: (): VNode =>
        h('div', [
          h(Window, {
            open: first.value,
            'onUpdate:open': (value: boolean) => (first.value = value),
            title: 'a.sh',
            closeLabel: 'Fermer a',
          }),
          h(Window, {
            open: second.value,
            'onUpdate:open': (value: boolean) => (second.value = value),
            title: 'b.sh',
            closeLabel: 'Fermer b',
          }),
        ]),
    };
    document.body.style.overflow = 'auto';
    const wrapper = await mountSuspended(Both);
    mounted.push(wrapper);
    await nextTick();

    expect(document.body.dataset['windowLocks']).toBe('2');
    first.value = false;
    await nextTick();
    expect(document.body.style.overflow).toBe('hidden');
    second.value = false;
    await nextTick();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('ouverte dès le montage : verrou posé et focus dans la fenêtre', async () => {
    await mountPage({ startOpen: true });
    await nextTick();

    expect(document.body.style.overflow).toBe('hidden');
    expect(dialog()).not.toBeNull();
    expect(dialog()?.contains(document.activeElement)).toBe(true);
  });

  it('démontée ouverte : le verrou et l’écouteur sont retirés', async () => {
    const wrapper = await mountPage();
    await open();

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);
    await nextTick();

    expect(document.body.style.overflow).toBe('');
    expect(dialog()).toBeNull();
    expect(pressKey('Escape').defaultPrevented).toBe(false);
  });

  it('une fois fermée, n’écoute plus le clavier', async () => {
    await mountPage();
    await open();
    pressKey('Escape');
    await nextTick();

    const escape = pressKey('Escape');

    expect(escape.defaultPrevented).toBe(false);
  });

  it('démontée fermée : rien à nettoyer', async () => {
    const wrapper = await mountPage();
    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(document.body.style.overflow).toBe('');
  });
});
