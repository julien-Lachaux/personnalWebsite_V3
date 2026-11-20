import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defineComponent,
  h,
  nextTick,
  ref,
  shallowRef,
  type PropType,
  type Ref,
  type VNode,
} from 'vue';

import { useActionBar, type UseActionBar } from './useActionBar.js';

const mounted: VueWrapper[] = [];

type Run = () => (() => VNode) | void;

/** Composant d'essai : exécute `run` dans `setup` (un seul composant défini dans ce fichier). */
const Probe = defineComponent({
  props: { run: { type: Function as PropType<Run>, required: true } },
  setup: (props) => props.run() ?? (() => h('div')),
});

/** Zone qui défile de remplacement : `scrollTop` se règle, `scroll` se déclenche à la main. */
function scrollArea(scrollTop = 0): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'scrollTop', { value: scrollTop, writable: true });
  return element;
}

function scrollTo(element: HTMLElement, scrollTop: number): void {
  element.scrollTop = scrollTop;
  element.dispatchEvent(new Event('scroll'));
}

interface Setup {
  bar: UseActionBar;
  scroller: Ref<HTMLElement | null>;
  tab: Ref<string>;
  clock: { now: number };
  wrapper: VueWrapper;
}

async function setup(initial: HTMLElement | null, now?: () => number): Promise<Setup> {
  const scroller = shallowRef<HTMLElement | null>(initial);
  const tab = ref('profile');
  const clock = { now: 1000 };
  let bar!: UseActionBar;
  const wrapper = await mountSuspended(Probe, {
    props: {
      run: () => {
        bar = useActionBar(scroller, tab, now ?? (() => clock.now));
      },
    },
  });
  mounted.push(wrapper);
  await nextTick();
  return { bar, scroller, tab, clock, wrapper };
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
});

describe('useActionBar', () => {
  it('démarre barre visible', async () => {
    const { bar } = await setup(scrollArea());

    expect(bar.hidden.value).toBe(false);
  });

  it('masque la barre au défilement vers le bas de plus de 24 px, la ramène en remontant de plus de 24 px', async () => {
    const area = scrollArea();
    const { bar, clock } = await setup(area);

    scrollTo(area, 24);
    expect(bar.hidden.value).toBe(false);
    scrollTo(area, 40);
    expect(bar.hidden.value).toBe(true);

    clock.now += 400;
    scrollTo(area, 20);
    expect(bar.hidden.value).toBe(false);
  });

  it('respecte le verrou de 360 ms après chaque bascule', async () => {
    const area = scrollArea();
    const { bar, clock } = await setup(area);
    scrollTo(area, 100);
    expect(bar.hidden.value).toBe(true);

    // Rebond 100 ms plus tard : ignoré, même vers le haut.
    clock.now += 100;
    scrollTo(area, 0);
    expect(bar.hidden.value).toBe(true);

    clock.now += 300;
    scrollTo(area, 0);
    expect(bar.hidden.value).toBe(false);
  });

  it('part du défilement déjà acquis quand la zone est montée plus bas dans la page', async () => {
    const area = scrollArea(500);
    const { bar } = await setup(area);

    scrollTo(area, 520);
    expect(bar.hidden.value).toBe(false);
    scrollTo(area, 530);
    expect(bar.hidden.value).toBe(true);
  });

  it('pose un écouteur de défilement passif sur la zone', async () => {
    const area = scrollArea();
    const add = vi.spyOn(area, 'addEventListener');

    await setup(area);

    expect(add).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
  });

  it('ramène la barre et la référence au changement d’onglet', async () => {
    const area = scrollArea();
    const { bar, tab, clock } = await setup(area);
    scrollTo(area, 200);
    expect(bar.hidden.value).toBe(true);

    tab.value = 'experience';
    await nextTick();
    expect(bar.hidden.value).toBe(false);

    // Même zone, restée à 200 px : la référence est le défilement courant, pas l'ancien.
    clock.now += 400;
    scrollTo(area, 220);
    expect(bar.hidden.value).toBe(false);
    scrollTo(area, 230);
    expect(bar.hidden.value).toBe(true);
  });

  it('lève aussi le verrou au changement d’onglet', async () => {
    const area = scrollArea();
    const { bar, tab } = await setup(area);
    scrollTo(area, 100);
    expect(bar.hidden.value).toBe(true);

    tab.value = 'ai';
    await nextTick();
    scrollTo(area, 200);

    expect(bar.hidden.value).toBe(true);
  });

  it('change de zone : retire l’écouteur de l’ancienne, écoute la nouvelle, barre visible', async () => {
    const first = scrollArea();
    const second = scrollArea(300);
    const remove = vi.spyOn(first, 'removeEventListener');
    const { bar, scroller, clock } = await setup(first);
    scrollTo(first, 100);
    expect(bar.hidden.value).toBe(true);

    scroller.value = second;
    await nextTick();

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(bar.hidden.value).toBe(false);
    clock.now += 400;
    scrollTo(first, 500);
    expect(bar.hidden.value).toBe(false);
    scrollTo(second, 350);
    expect(bar.hidden.value).toBe(true);
  });

  it('n’écoute rien sans zone, et se met en route quand elle apparaît', async () => {
    const { bar, scroller, tab } = await setup(null);
    expect(bar.hidden.value).toBe(false);

    tab.value = 'experience';
    await nextTick();
    expect(bar.hidden.value).toBe(false);

    const area = scrollArea();
    scroller.value = area;
    await nextTick();
    scrollTo(area, 100);
    expect(bar.hidden.value).toBe(true);
  });

  it('retire son écouteur au démontage', async () => {
    const area = scrollArea();
    const remove = vi.spyOn(area, 'removeEventListener');
    const { wrapper, bar } = await setup(area);

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    scrollTo(area, 300);
    expect(bar.hidden.value).toBe(false);
  });

  it('lit l’heure de Date.now par défaut', async () => {
    const area = scrollArea();
    const now = vi.spyOn(Date, 'now').mockReturnValue(5000);
    const scroller = shallowRef<HTMLElement | null>(area);
    let bar!: UseActionBar;
    mounted.push(
      await mountSuspended(Probe, {
        props: {
          run: () => {
            bar = useActionBar(scroller, ref('profile'));
          },
        },
      }),
    );
    await nextTick();

    scrollTo(area, 100);
    expect(bar.hidden.value).toBe(true);
    expect(now).toHaveBeenCalled();

    // 5000 + 360 : le verrou posé par la bascule est encore actif à 5359.
    now.mockReturnValue(5359);
    scrollTo(area, 0);
    expect(bar.hidden.value).toBe(true);
    now.mockReturnValue(5360);
    scrollTo(area, 0);
    expect(bar.hidden.value).toBe(false);
  });
});
