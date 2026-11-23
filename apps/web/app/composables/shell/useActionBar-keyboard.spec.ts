import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, shallowRef, type PropType } from 'vue';

import { useActionBar, type UseActionBar } from './useActionBar.js';

// Constat RA-2 (WCAG 2.1.1) : la barre masquée est `inert`, donc hors du parcours au clavier. Tant que le
// focus est dans la zone qui défile et vient du clavier (`:focus-visible`), elle ne se masque pas et elle
// revient dès que le focus clavier y entre. La souris (focus sans `:focus-visible`) ne change rien.

const mounted: VueWrapper[] = [];
const elements: HTMLElement[] = [];

type Run = () => void;

const Probe = defineComponent({
  props: { run: { type: Function as PropType<Run>, required: true } },
  setup: (props) => {
    props.run();
    return () => h('div');
  },
});

/** Zone qui défile dans le document, avec un bouton ; `scrollTop` se règle, `scroll` se déclenche à la main. */
function area(): { zone: HTMLElement; button: HTMLButtonElement } {
  const zone = document.createElement('div');
  const button = document.createElement('button');
  zone.append(button);
  document.body.append(zone);
  elements.push(zone);
  Object.defineProperty(zone, 'scrollTop', { value: 0, writable: true });
  return { zone, button };
}

function scrollTo(zone: HTMLElement, scrollTop: number): void {
  zone.scrollTop = scrollTop;
  zone.dispatchEvent(new Event('scroll'));
}

/** Le focus de `button` vient du clavier (ou de la souris) : `:focus-visible` simulé. */
function focusFrom(button: HTMLButtonElement, keyboard: boolean): void {
  vi.spyOn(button, 'matches').mockImplementation((selector) => {
    if (selector === ':focus-visible') return keyboard;
    throw new Error(`sélecteur inattendu : ${selector}`);
  });
  button.focus();
}

async function setup(zone: HTMLElement): Promise<UseActionBar> {
  const scroller = shallowRef<HTMLElement | null>(zone);
  let bar!: UseActionBar;
  mounted.push(
    await mountSuspended(Probe, {
      props: {
        run: () => {
          bar = useActionBar(scroller, shallowRef('profile'), () => 1000);
        },
      },
    }),
  );
  await nextTick();
  return bar;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const element of elements.splice(0)) element.remove();
  vi.restoreAllMocks();
});

describe('useActionBar : navigation au clavier', () => {
  it('ne masque pas la barre au défilement tant que le focus clavier est dans la zone', async () => {
    const { zone, button } = area();
    const bar = await setup(zone);
    focusFrom(button, true);

    scrollTo(zone, 100);

    expect(bar.hidden.value).toBe(false);
  });

  it('masque la barre au défilement quand le focus de la zone vient de la souris', async () => {
    const { zone, button } = area();
    const bar = await setup(zone);
    focusFrom(button, false);

    scrollTo(zone, 100);

    expect(bar.hidden.value).toBe(true);
  });

  it('masque la barre au défilement quand le focus est hors de la zone', async () => {
    const { zone } = area();
    const outside = area().button;
    const bar = await setup(zone);
    focusFrom(outside, true);

    scrollTo(zone, 100);

    expect(bar.hidden.value).toBe(true);
  });

  it('masque la barre au défilement quand rien n’a le focus', async () => {
    const { zone } = area();
    const bar = await setup(zone);
    (document.activeElement as HTMLElement | null)?.blur();

    scrollTo(zone, 100);

    expect(bar.hidden.value).toBe(true);
  });

  it('ramène la barre masquée quand le focus clavier entre dans la zone', async () => {
    const { zone, button } = area();
    const bar = await setup(zone);
    scrollTo(zone, 100);
    expect(bar.hidden.value).toBe(true);

    focusFrom(button, true);
    await nextTick();

    expect(bar.hidden.value).toBe(false);
  });

  it('laisse la barre masquée quand le focus entre dans la zone par la souris', async () => {
    const { zone, button } = area();
    const bar = await setup(zone);
    scrollTo(zone, 100);

    focusFrom(button, false);
    await nextTick();

    expect(bar.hidden.value).toBe(true);
  });

  it('laisse la barre masquée quand le focus clavier entre hors de la zone', async () => {
    const { zone } = area();
    const outside = area().button;
    const bar = await setup(zone);
    scrollTo(zone, 100);

    focusFrom(outside, true);
    await nextTick();

    expect(bar.hidden.value).toBe(true);
  });

  it('retire l’écouteur de focus au démontage', async () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { zone } = area();
    await setup(zone);

    mounted.pop()!.unmount();

    expect(remove).toHaveBeenCalledWith('focusin', expect.any(Function));
  });
});
