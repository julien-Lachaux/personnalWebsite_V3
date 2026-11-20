import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, type PropType, type VNode } from 'vue';
import { clearNuxtState } from '#imports';

import {
  PREFERENCES_STORAGE_KEY,
  defaultPreferences,
  serializePreferences,
  type Preferences,
} from '../../domain/preferences.js';
import {
  PREFERENCES_STATE_KEY,
  SERVER_SYSTEM,
  browserStorage,
  usePreferences,
  type UsePreferences,
} from './usePreferences.js';

const DARK_MOTION = { prefersDark: true, prefersReducedMotion: true };
const LIGHT = { prefersDark: false, prefersReducedMotion: false };

const CUSTOM: Preferences = {
  theme: 'clair',
  textSize: 130,
  highContrast: true,
  readableFont: true,
  textSpacing: true,
  underlineLinks: true,
  reduceMotion: true,
};

const mounted: VueWrapper[] = [];

type Run = () => (() => VNode) | void;

/** Composant d'essai : exécute `run` dans `setup` (un seul composant défini dans ce fichier). */
const Probe = defineComponent({
  props: { run: { type: Function as PropType<Run>, required: true } },
  setup: (props) => props.run() ?? (() => h('div')),
});

/** Stockage de remplacement qui enregistre ses appels ; `failing` fait lever les opérations citées. */
function installStorage(failing: ('getItem' | 'setItem' | 'removeItem')[] = []): {
  items: Map<string, string>;
  calls: string[];
} {
  const items = new Map<string, string>();
  const calls: string[] = [];
  const run = <T>(name: 'getItem' | 'setItem' | 'removeItem', key: string, action: () => T): T => {
    calls.push(`${name}:${key}`);
    if (failing.includes(name)) throw new DOMException('refusé', 'SecurityError');
    return action();
  };
  const storage = {
    getItem: (key: string) => run('getItem', key, () => items.get(key) ?? null),
    setItem: (key: string, value: string) => run('setItem', key, () => void items.set(key, value)),
    removeItem: (key: string) => run('removeItem', key, () => void items.delete(key)),
  };
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as unknown as Storage);
  return { items, calls };
}

/** Monte un composant qui n'affiche rien et rend l'API du composable. */
async function useInComponent(): Promise<UsePreferences> {
  let api!: UsePreferences;
  mounted.push(
    await mountSuspended(Probe, {
      props: {
        run: () => {
          api = usePreferences();
        },
      },
    }),
  );
  return api;
}

function stored(): unknown {
  const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  clearNuxtState(PREFERENCES_STATE_KEY);
  window.localStorage.clear();
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
});

describe('état initial (rendu statique)', () => {
  it('part des valeurs du système supposé : thème sombre, animations normales, rien d’enregistré', async () => {
    const api = await useInComponent();

    expect(SERVER_SYSTEM).toEqual({ prefersDark: true, prefersReducedMotion: false });
    expect(api.preferences.value).toEqual(defaultPreferences(SERVER_SYSTEM));
    expect(api.preferences.value.theme).toBe('sombre');
    expect(api.followsSystem.value).toBe(true);
  });

  it('ne lit ni n’écrit le stockage tant qu’aucune action ni hydratation n’a lieu', async () => {
    const { calls } = installStorage();

    const api = await useInComponent();

    expect(calls).toEqual([]);
    // Témoin : le stockage de remplacement voit bien les accès faits par les actions.
    api.hydrate(LIGHT);
    api.set('highContrast', true);
    expect(calls).toEqual([
      `getItem:${PREFERENCES_STORAGE_KEY}`,
      `setItem:${PREFERENCES_STORAGE_KEY}`,
    ]);
  });

  it('partage le même état entre deux composants', async () => {
    const first = await useInComponent();
    const second = await useInComponent();

    first.set('textSize', 115);

    expect(second.preferences.value.textSize).toBe(115);
  });
});

describe('hydrate', () => {
  it('relit les réglages enregistrés, qui l’emportent sur le système, et cesse de le suivre', async () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(CUSTOM));
    const api = await useInComponent();

    api.hydrate(DARK_MOTION);

    expect(api.preferences.value).toEqual(CUSTOM);
    expect(api.followsSystem.value).toBe(false);
  });

  it('prend les valeurs du système quand rien n’est enregistré, et le suit', async () => {
    const api = await useInComponent();

    api.hydrate(DARK_MOTION);

    expect(api.preferences.value).toEqual(defaultPreferences(DARK_MOTION));
    expect(api.followsSystem.value).toBe(true);
  });

  it('prend les valeurs du système pour un document illisible', async () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, '{pas du json');
    const api = await useInComponent();

    api.hydrate(LIGHT);

    expect(api.preferences.value).toEqual(defaultPreferences(LIGHT));
    expect(api.followsSystem.value).toBe(true);
  });

  it('tolère un stockage inaccessible (cookies bloqués)', async () => {
    const access = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('refusé', 'SecurityError');
    });
    const api = await useInComponent();

    api.hydrate(LIGHT);

    expect(access).toHaveBeenCalled();
    expect(api.preferences.value).toEqual(defaultPreferences(LIGHT));
    expect(api.followsSystem.value).toBe(true);
  });
});

describe('set', () => {
  it('change un réglage, enregistre tous les réglages et cesse de suivre le système', async () => {
    const api = await useInComponent();
    api.hydrate(LIGHT);

    api.set('highContrast', true);

    expect(api.preferences.value).toEqual({ ...defaultPreferences(LIGHT), highContrast: true });
    expect(api.followsSystem.value).toBe(false);
    expect(stored()).toEqual({
      version: 1,
      theme: 'clair',
      textSize: 100,
      highContrast: true,
      readableFont: false,
      textSpacing: false,
      underlineLinks: false,
      reduceMotion: false,
    });
  });

  it('garde les autres réglages d’un appel à l’autre', async () => {
    const api = await useInComponent();
    api.hydrate(LIGHT);

    api.set('textSize', 130);
    api.set('readableFont', true);

    expect(api.preferences.value).toMatchObject({ textSize: 130, readableFont: true });
    expect(stored()).toMatchObject({ textSize: 130, readableFont: true });
  });

  it('applique le réglage même si le stockage refuse l’écriture', async () => {
    const { calls } = installStorage(['setItem']);
    const api = await useInComponent();

    api.set('underlineLinks', true);

    expect(calls).toEqual([`setItem:${PREFERENCES_STORAGE_KEY}`]);
    expect(api.preferences.value.underlineLinks).toBe(true);
  });
});

describe('toggleTheme', () => {
  it('bascule entre sombre et clair et l’enregistre', async () => {
    const api = await useInComponent();
    api.hydrate(DARK_MOTION);

    api.toggleTheme();
    expect(api.preferences.value.theme).toBe('clair');
    expect(stored()).toMatchObject({ theme: 'clair' });

    api.toggleTheme();
    expect(api.preferences.value.theme).toBe('sombre');
    expect(stored()).toMatchObject({ theme: 'sombre' });
  });
});

describe('reset (D11)', () => {
  it('supprime le réglage enregistré et rend les valeurs du système', async () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(CUSTOM));
    window.localStorage.setItem('autre', 'valeur');
    const api = await useInComponent();
    api.hydrate(DARK_MOTION);

    api.reset();

    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem('autre')).toBe('valeur');
    expect(api.preferences.value).toEqual(defaultPreferences(DARK_MOTION));
    expect(api.followsSystem.value).toBe(true);
  });

  it('suit de nouveau les changements du système après la réinitialisation', async () => {
    const api = await useInComponent();
    api.hydrate(LIGHT);
    api.set('theme', 'sombre');
    api.followSystem(DARK_MOTION);
    expect(api.preferences.value.theme).toBe('sombre');

    api.reset();
    api.followSystem(LIGHT);

    expect(api.preferences.value).toEqual(defaultPreferences(LIGHT));
  });

  it('se fait même si le stockage refuse la suppression', async () => {
    const { calls } = installStorage(['removeItem']);
    const api = await useInComponent();
    api.hydrate(LIGHT);
    api.set('highContrast', true);

    api.reset();

    expect(calls).toContain(`removeItem:${PREFERENCES_STORAGE_KEY}`);
    expect(api.preferences.value).toEqual(defaultPreferences(LIGHT));
    expect(api.followsSystem.value).toBe(true);
  });
});

describe('followSystem', () => {
  it('met à jour le thème et les animations tant que rien n’est enregistré', async () => {
    const api = await useInComponent();
    api.hydrate(LIGHT);

    api.followSystem(DARK_MOTION);

    expect(api.preferences.value).toEqual(defaultPreferences(DARK_MOTION));
    expect(api.followsSystem.value).toBe(true);
  });

  it('ne touche pas aux réglages enregistrés', async () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(CUSTOM));
    const api = await useInComponent();
    api.hydrate(LIGHT);

    api.followSystem(DARK_MOTION);

    expect(api.preferences.value).toEqual(CUSTOM);
    expect(api.followsSystem.value).toBe(false);
  });

  it('retient le système pour la réinitialisation suivante', async () => {
    const api = await useInComponent();
    api.hydrate(LIGHT);
    api.set('highContrast', true);
    api.followSystem(DARK_MOTION);

    api.reset();

    expect(api.preferences.value).toEqual(defaultPreferences(DARK_MOTION));
  });
});

describe('browserStorage', () => {
  it('rend le stockage du navigateur', () => {
    expect(browserStorage()).toBe(window.localStorage);
  });

  it('rend null quand l’accès au stockage lève', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('refusé', 'SecurityError');
    });

    expect(browserStorage()).toBeNull();
  });

  it('rend null sans fenêtre (rendu serveur)', () => {
    vi.stubGlobal('window', undefined);
    try {
      expect(browserStorage()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('réactivité', () => {
  it('notifie les composants qui lisent les préférences', async () => {
    const api = await useInComponent();
    const seen: string[] = [];
    mounted.push(
      await mountSuspended(Probe, {
        props: {
          run: () => {
            const { preferences } = usePreferences();
            return () => {
              seen.push(preferences.value.theme);
              return h('div');
            };
          },
        },
      }),
    );

    api.toggleTheme();
    await nextTick();

    expect(seen).toEqual(['sombre', 'clair']);
  });
});
