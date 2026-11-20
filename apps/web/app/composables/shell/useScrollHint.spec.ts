import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { defineComponent, h, nextTick, shallowRef, type PropType, type Ref, type VNode } from 'vue';
import { clearNuxtState } from '#imports';

import { PREFERENCES_STATE_KEY, usePreferences } from './usePreferences.js';
import { SCROLL_HINT_STEP, useScrollHint, type UseScrollHint } from './useScrollHint.js';

/** `ResizeObserver` de remplacement : éléments observés, déconnexions, déclenchement manuel. */
class FakeResizeObserver {
  static readonly all: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnects = 0;
  readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.all.push(this);
  }
  observe(element: Element): void {
    this.observed.push(element);
  }
  disconnect(): void {
    this.observed = [];
    this.disconnects += 1;
  }
}

/** `MutationObserver` de remplacement. */
class FakeMutationObserver {
  static readonly all: FakeMutationObserver[] = [];
  target: Node | null = null;
  options: MutationObserverInit | null = null;
  disconnects = 0;
  readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeMutationObserver.all.push(this);
  }
  observe(target: Node, options: MutationObserverInit): void {
    this.target = target;
    this.options = options;
  }
  disconnect(): void {
    this.disconnects += 1;
  }
}

interface Metrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

/** Zone qui défile de remplacement : mesures réglables, `scrollBy` espionné, trois enfants. */
function scrollArea(metrics: Metrics, children = 2): HTMLElement {
  const element = document.createElement('div');
  for (const [name, value] of Object.entries(metrics)) {
    Object.defineProperty(element, name, { value, writable: true, configurable: true });
  }
  for (let index = 0; index < children; index += 1) element.append(document.createElement('p'));
  const scrollBy = vi.fn();
  Object.defineProperty(element, 'scrollBy', { value: scrollBy, configurable: true });
  return element;
}

/** Le `scrollBy` espionné d'une zone créée par `scrollArea`. */
function scrollByOf(element: HTMLElement): Mock {
  return (element as unknown as { scrollBy: Mock }).scrollBy;
}

function setMetrics(element: HTMLElement, metrics: Partial<Metrics>): void {
  for (const [name, value] of Object.entries(metrics)) {
    Object.defineProperty(element, name, { value, writable: true, configurable: true });
  }
}

const mounted: VueWrapper[] = [];

type Run = () => (() => VNode) | void;

/** Composant d'essai : exécute `run` dans `setup` (un seul composant défini dans ce fichier). */
const Probe = defineComponent({
  props: { run: { type: Function as PropType<Run>, required: true } },
  setup: (props) => props.run() ?? (() => h('div')),
});
let fontsReady: Promise<void>;
let resolveFonts: () => void;

async function setup(
  initial: HTMLElement | null,
): Promise<{ hint: UseScrollHint; scroller: Ref<HTMLElement | null>; wrapper: VueWrapper }> {
  const scroller = shallowRef<HTMLElement | null>(initial);
  let hint!: UseScrollHint;
  const wrapper = await mountSuspended(Probe, {
    props: {
      run: () => {
        hint = useScrollHint(scroller);
      },
    },
  });
  mounted.push(wrapper);
  await nextTick();
  return { hint, scroller, wrapper };
}

const LONG: Metrics = { scrollHeight: 1000, scrollTop: 0, clientHeight: 600 };
const SHORT: Metrics = { scrollHeight: 600, scrollTop: 0, clientHeight: 600 };

beforeEach(() => {
  FakeResizeObserver.all.length = 0;
  FakeMutationObserver.all.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('MutationObserver', FakeMutationObserver);
  fontsReady = new Promise<void>((resolve) => {
    resolveFonts = resolve;
  });
  Object.defineProperty(document, 'fonts', {
    value: { ready: fontsReady },
    configurable: true,
  });
  clearNuxtState(PREFERENCES_STATE_KEY);
  window.localStorage.clear();
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'fonts');
});

describe('useScrollHint : mesure', () => {
  it('est vrai quand du contenu reste caché, faux sinon', async () => {
    expect((await setup(scrollArea(LONG))).hint.more.value).toBe(true);
    expect((await setup(scrollArea(SHORT))).hint.more.value).toBe(false);
  });

  it('tolère 2 px de reste (arrondis de mesure)', async () => {
    const area = scrollArea({ scrollHeight: 602, scrollTop: 0, clientHeight: 600 });
    expect((await setup(area)).hint.more.value).toBe(false);
  });

  it('se remesure au défilement, avec un écouteur passif', async () => {
    const area = scrollArea(LONG);
    const add = vi.spyOn(area, 'addEventListener');
    const { hint } = await setup(area);
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });

    setMetrics(area, { scrollTop: 400 });
    area.dispatchEvent(new Event('scroll'));
    expect(hint.more.value).toBe(false);

    setMetrics(area, { scrollTop: 100 });
    area.dispatchEvent(new Event('scroll'));
    expect(hint.more.value).toBe(true);
  });

  it('se remesure quand la zone ou un enfant change de taille', async () => {
    const area = scrollArea(SHORT);
    const { hint } = await setup(area);
    expect(hint.more.value).toBe(false);

    setMetrics(area, { scrollHeight: 900 });
    FakeResizeObserver.all[0]!.callback();

    expect(hint.more.value).toBe(true);
  });

  it('observe la zone et chacun de ses enfants', async () => {
    const area = scrollArea(LONG, 3);
    await setup(area);

    expect(FakeResizeObserver.all).toHaveLength(1);
    expect(FakeResizeObserver.all[0]!.observed).toEqual([area, ...Array.from(area.children)]);
  });

  it('observe les changements de contenu de la zone, sous-arbre compris', async () => {
    const area = scrollArea(LONG);
    await setup(area);

    expect(FakeMutationObserver.all).toHaveLength(1);
    expect(FakeMutationObserver.all[0]!.target).toBe(area);
    expect(FakeMutationObserver.all[0]!.options).toEqual({
      childList: true,
      subtree: true,
      characterData: true,
    });
  });

  it('change de contenu : observe les nouveaux enfants et se remesure', async () => {
    const area = scrollArea(SHORT, 1);
    const { hint } = await setup(area);
    const resize = FakeResizeObserver.all[0]!;
    const disconnectsBefore = resize.disconnects;
    const added = document.createElement('section');
    area.append(added);
    setMetrics(area, { scrollHeight: 1200 });

    FakeMutationObserver.all[0]!.callback();

    expect(resize.disconnects).toBe(disconnectsBefore + 1);
    expect(resize.observed).toEqual([area, ...Array.from(area.children)]);
    expect(resize.observed).toContain(added);
    expect(hint.more.value).toBe(true);
  });

  it('se remesure une fois les polices chargées', async () => {
    const area = scrollArea(SHORT);
    const { hint } = await setup(area);
    setMetrics(area, { scrollHeight: 900 });
    expect(hint.more.value).toBe(false);

    resolveFonts();
    await fontsReady;
    await nextTick();

    expect(hint.more.value).toBe(true);
  });

  it('ne se remesure pas après la fin si les polices arrivent tard', async () => {
    const area = scrollArea(SHORT);
    const { hint, scroller } = await setup(area);
    scroller.value = null;
    await nextTick();
    setMetrics(area, { scrollHeight: 900 });

    resolveFonts();
    await fontsReady;
    await nextTick();

    expect(hint.more.value).toBe(false);
  });
});

describe('useScrollHint : changement et retrait de la zone', () => {
  it('sans zone, rien n’est observé et la flèche est absente', async () => {
    const { hint } = await setup(null);

    expect(hint.more.value).toBe(false);
    expect(FakeResizeObserver.all).toHaveLength(0);
    expect(FakeMutationObserver.all).toHaveLength(0);
  });

  it('déconnecte tout et retire l’écouteur quand la zone disparaît, flèche absente', async () => {
    const area = scrollArea(LONG);
    const remove = vi.spyOn(area, 'removeEventListener');
    const { hint, scroller } = await setup(area);
    expect(hint.more.value).toBe(true);

    scroller.value = null;
    await nextTick();

    expect(hint.more.value).toBe(false);
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(FakeResizeObserver.all[0]!.disconnects).toBeGreaterThanOrEqual(1);
    expect(FakeMutationObserver.all[0]!.disconnects).toBe(1);
  });

  it('passe à la nouvelle zone : mesure la nouvelle, plus l’ancienne', async () => {
    const first = scrollArea(LONG);
    const second = scrollArea(SHORT);
    const { hint, scroller } = await setup(first);
    expect(hint.more.value).toBe(true);

    scroller.value = second;
    await nextTick();
    expect(hint.more.value).toBe(false);
    expect(FakeResizeObserver.all).toHaveLength(2);
    expect(FakeResizeObserver.all[1]!.observed[0]).toBe(second);

    setMetrics(first, { scrollHeight: 5000 });
    first.dispatchEvent(new Event('scroll'));
    expect(hint.more.value).toBe(false);
  });

  it('déconnecte et retire ses écouteurs au démontage', async () => {
    const area = scrollArea(LONG);
    const remove = vi.spyOn(area, 'removeEventListener');
    const { wrapper } = await setup(area);

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(FakeMutationObserver.all[0]!.disconnects).toBe(1);
    expect(FakeResizeObserver.all[0]!.observed).toEqual([]);
  });
});

describe('useScrollHint : scrollDown', () => {
  it('descend de 80 % de la hauteur visible, avec animation', async () => {
    const area = scrollArea({ scrollHeight: 2000, scrollTop: 0, clientHeight: 593 });
    const { hint } = await setup(area);

    hint.scrollDown();

    expect(SCROLL_HINT_STEP).toBe(0.8);
    expect(scrollByOf(area)).toHaveBeenCalledOnce();
    expect(scrollByOf(area)).toHaveBeenCalledWith({ top: 474, behavior: 'smooth' });
  });

  it('défile sans animation quand les animations sont réduites', async () => {
    const area = scrollArea(LONG);
    const { hint } = await setup(area);
    await reduceMotion();

    hint.scrollDown();

    expect(scrollByOf(area)).toHaveBeenCalledWith({ top: 480, behavior: 'auto' });
  });

  it('ne fait rien sans zone', async () => {
    const { hint } = await setup(null);

    expect(() => hint.scrollDown()).not.toThrow();
  });
});

/** Règle `reduceMotion` dans l'état partagé, comme le ferait le panneau d'accessibilité. */
async function reduceMotion(): Promise<void> {
  mounted.push(
    await mountSuspended(Probe, {
      props: {
        run: () => {
          usePreferences().set('reduceMotion', true);
        },
      },
    }),
  );
}
