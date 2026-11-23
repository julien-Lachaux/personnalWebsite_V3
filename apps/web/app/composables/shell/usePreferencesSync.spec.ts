import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent, h, nextTick, type PropType, type VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { clearNuxtState, useNuxtApp } from '#imports';

import {
  PREFERENCES_STORAGE_KEY,
  serializePreferences,
  type Preferences,
} from '../../domain/preferences.js';
import { PREFERENCES_STATE_KEY, usePreferences, type UsePreferences } from './usePreferences.js';
import { DARK_QUERY, REDUCED_MOTION_QUERY, rootAttributes } from '../../domain/root-attributes.js';
import { applyRootAttributes, usePreferencesSync } from './usePreferencesSync.js';

const ATTRIBUTES = [
  'data-theme',
  'data-contrast',
  'data-text-size',
  'data-font',
  'data-spacing',
  'data-links',
  'data-motion',
];

const BASE: Preferences = {
  theme: 'clair',
  textSize: 100,
  highContrast: false,
  readableFont: false,
  textSpacing: false,
  underlineLinks: false,
  reduceMotion: false,
};

const EVERYTHING: Preferences = {
  theme: 'sombre',
  textSize: 130,
  highContrast: true,
  readableFont: true,
  textSpacing: true,
  underlineLinks: true,
  reduceMotion: true,
};

describe('rootAttributes', () => {
  it('décrit un affichage sans réglage : seuls le thème, la taille et le mouvement sont posés', () => {
    expect(rootAttributes(BASE)).toEqual({
      'data-theme': 'clair',
      'data-contrast': null,
      'data-text-size': '100',
      'data-font': null,
      'data-spacing': null,
      'data-links': null,
      'data-motion': 'normal',
    });
  });

  it('décrit tous les réglages activés, avec les valeurs de l’interface de tokens.css', () => {
    expect(rootAttributes(EVERYTHING)).toEqual({
      'data-theme': 'sombre',
      'data-contrast': 'renforce',
      'data-text-size': '130',
      'data-font': 'lisible',
      'data-spacing': 'augmente',
      'data-links': 'soulignes',
      'data-motion': 'reduit',
    });
  });

  it('traduit chaque taille du texte', () => {
    expect(rootAttributes({ ...BASE, textSize: 115 })['data-text-size']).toBe('115');
    expect(rootAttributes({ ...BASE, textSize: 130 })['data-text-size']).toBe('130');
  });

  it('traduit chaque réglage indépendamment des autres', () => {
    expect(rootAttributes({ ...BASE, highContrast: true })).toMatchObject({
      'data-contrast': 'renforce',
      'data-font': null,
      'data-spacing': null,
      'data-links': null,
      'data-motion': 'normal',
    });
    expect(rootAttributes({ ...BASE, readableFont: true })).toMatchObject({
      'data-contrast': null,
      'data-font': 'lisible',
    });
    expect(rootAttributes({ ...BASE, textSpacing: true })).toMatchObject({
      'data-font': null,
      'data-spacing': 'augmente',
      'data-links': null,
    });
    expect(rootAttributes({ ...BASE, underlineLinks: true })).toMatchObject({
      'data-spacing': null,
      'data-links': 'soulignes',
    });
    expect(rootAttributes({ ...BASE, reduceMotion: true })).toMatchObject({
      'data-links': null,
      'data-motion': 'reduit',
    });
  });
});

describe('applyRootAttributes', () => {
  it('pose les valeurs et retire les attributs à null', () => {
    const element = document.createElement('div');
    element.setAttribute('data-font', 'lisible');
    element.setAttribute('data-autre', 'intact');

    applyRootAttributes(element, { 'data-theme': 'sombre', 'data-font': null });

    expect(element.getAttribute('data-theme')).toBe('sombre');
    expect(element.hasAttribute('data-font')).toBe(false);
    expect(element.getAttribute('data-autre')).toBe('intact');
  });
});

/** Liste de médias de remplacement : valeur courante, écouteurs, déclenchement manuel. */
class FakeMedia {
  matches: boolean;
  readonly listeners = new Set<() => void>();
  constructor(matches: boolean) {
    this.matches = matches;
  }
  addEventListener(type: string, listener: () => void): void {
    expect(type).toBe('change');
    this.listeners.add(listener);
  }
  removeEventListener(type: string, listener: () => void): void {
    expect(type).toBe('change');
    this.listeners.delete(listener);
  }
  change(matches: boolean): void {
    this.matches = matches;
    for (const listener of [...this.listeners]) listener();
  }
}

interface Media {
  dark: FakeMedia;
  motion: FakeMedia;
  queries: string[];
}

function installMedia(prefersDark: boolean, prefersReducedMotion: boolean): Media {
  const media: Media = {
    dark: new FakeMedia(prefersDark),
    motion: new FakeMedia(prefersReducedMotion),
    queries: [],
  };
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    media.queries.push(query);
    if (query === DARK_QUERY) return media.dark as unknown as MediaQueryList;
    if (query === REDUCED_MOTION_QUERY) return media.motion as unknown as MediaQueryList;
    throw new Error(`requête inattendue : ${query}`);
  });
  return media;
}

const mounted: VueWrapper[] = [];

type Run = () => (() => VNode) | void;

/** Composant d'essai : exécute `run` dans `setup` (un seul composant défini dans ce fichier). */
const Probe = defineComponent({
  props: { run: { type: Function as PropType<Run>, required: true } },
  setup: (props) => props.run() ?? (() => h('div')),
});

async function mountSync(): Promise<{ wrapper: VueWrapper; api: UsePreferences }> {
  let api!: UsePreferences;
  const wrapper = await mountSuspended(Probe, {
    props: {
      run: () => {
        usePreferencesSync();
        api = usePreferences();
      },
    },
  });
  mounted.push(wrapper);
  return { wrapper, api };
}

function rootState(): Record<string, string | null> {
  return Object.fromEntries(
    ATTRIBUTES.map((name) => [name, document.documentElement.getAttribute(name)]),
  );
}

beforeEach(() => {
  clearNuxtState(PREFERENCES_STATE_KEY);
  window.localStorage.clear();
  for (const name of ATTRIBUTES) document.documentElement.removeAttribute(name);
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
  for (const name of ATTRIBUTES) document.documentElement.removeAttribute(name);
});

describe('usePreferencesSync : montage', () => {
  it('lit les deux préférences du système et pose les attributs de <html> qui les suivent', async () => {
    const media = installMedia(true, true);

    await mountSync();

    expect(media.queries).toEqual([DARK_QUERY, REDUCED_MOTION_QUERY]);
    expect(rootState()).toEqual({
      'data-theme': 'sombre',
      'data-contrast': null,
      'data-text-size': '100',
      'data-font': null,
      'data-spacing': null,
      'data-links': null,
      'data-motion': 'reduit',
    });
  });

  it('suit un système clair sans animations réduites', async () => {
    installMedia(false, false);

    await mountSync();

    expect(document.documentElement.getAttribute('data-theme')).toBe('clair');
    expect(document.documentElement.getAttribute('data-motion')).toBe('normal');
  });

  it('restaure les réglages enregistrés, qui l’emportent sur le système, et retire les attributs restés en place', async () => {
    installMedia(false, false);
    document.documentElement.setAttribute('data-contrast', 'renforce');
    document.documentElement.setAttribute('data-font', 'lisible');
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      serializePreferences({ ...EVERYTHING, highContrast: false, readableFont: false }),
    );

    await mountSync();

    expect(rootState()).toEqual({
      'data-theme': 'sombre',
      'data-contrast': null,
      'data-text-size': '130',
      'data-font': null,
      'data-spacing': 'augmente',
      'data-links': 'soulignes',
      'data-motion': 'reduit',
    });
  });

  it('pose tous les attributs quand tous les réglages sont enregistrés', async () => {
    installMedia(false, false);
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(EVERYTHING));

    await mountSync();

    expect(rootState()).toEqual({
      'data-theme': 'sombre',
      'data-contrast': 'renforce',
      'data-text-size': '130',
      'data-font': 'lisible',
      'data-spacing': 'augmente',
      'data-links': 'soulignes',
      'data-motion': 'reduit',
    });
  });
});

describe('usePreferencesSync : changements de réglage', () => {
  it('répercute chaque réglage sur <html> aussitôt', async () => {
    installMedia(false, false);
    const { api } = await mountSync();

    api.set('highContrast', true);
    expect(document.documentElement.getAttribute('data-contrast')).toBe('renforce');
    api.set('textSize', 115);
    expect(document.documentElement.getAttribute('data-text-size')).toBe('115');
    api.set('readableFont', true);
    expect(document.documentElement.getAttribute('data-font')).toBe('lisible');
    api.set('highContrast', false);
    expect(document.documentElement.hasAttribute('data-contrast')).toBe(false);
    api.toggleTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('sombre');
  });

  it('rend les attributs du système à la réinitialisation (D11)', async () => {
    installMedia(true, false);
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(BASE));
    const { api } = await mountSync();
    expect(document.documentElement.getAttribute('data-theme')).toBe('clair');

    api.reset();

    expect(rootState()).toEqual({
      'data-theme': 'sombre',
      'data-contrast': null,
      'data-text-size': '100',
      'data-font': null,
      'data-spacing': null,
      'data-links': null,
      'data-motion': 'normal',
    });
  });
});

describe('usePreferencesSync : préférences du système', () => {
  it('suit le thème et les animations du système tant que rien n’est enregistré', async () => {
    const media = installMedia(false, false);
    await mountSync();

    media.dark.change(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('sombre');
    media.motion.change(true);
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduit');
    media.dark.change(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('clair');
    media.motion.change(false);
    expect(document.documentElement.getAttribute('data-motion')).toBe('normal');
  });

  it('ignore le système quand un réglage est enregistré', async () => {
    const media = installMedia(false, false);
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(BASE));
    await mountSync();

    media.dark.change(true);
    media.motion.change(true);

    expect(document.documentElement.getAttribute('data-theme')).toBe('clair');
    expect(document.documentElement.getAttribute('data-motion')).toBe('normal');
  });

  it('ignore le système après un choix de l’utilisateur, le suit de nouveau après la réinitialisation', async () => {
    const media = installMedia(false, false);
    const { api } = await mountSync();
    api.set('theme', 'sombre');

    media.dark.change(true);
    media.dark.change(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('sombre');

    api.reset();
    media.dark.change(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('sombre');
    media.dark.change(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('clair');
  });
});

describe('usePreferencesSync : démontage', () => {
  it('retire ses deux écouteurs de média et cesse d’écrire sur <html>', async () => {
    const media = installMedia(false, false);
    const { wrapper, api } = await mountSync();
    expect(media.dark.listeners.size).toBe(1);
    expect(media.motion.listeners.size).toBe(1);

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(media.dark.listeners.size).toBe(0);
    expect(media.motion.listeners.size).toBe(0);
    api.set('highContrast', true);
    media.dark.change(true);
    await nextTick();
    expect(document.documentElement.hasAttribute('data-contrast')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('clair');
  });
});

describe('rendu serveur', () => {
  it('ne touche ni au DOM, ni à matchMedia, ni au stockage (le montage n’a pas lieu)', async () => {
    const media = installMedia(true, true);
    const setAttribute = vi.spyOn(document.documentElement, 'setAttribute');
    const app = createSSRApp(Probe, {
      run: () => {
        usePreferencesSync();
        return () => h('p', 'rendu');
      },
    });

    const html = await useNuxtApp().runWithContext(() => renderToString(app));

    expect(html).toBe('<p>rendu</p>');
    expect(media.queries).toEqual([]);
    expect(setAttribute).not.toHaveBeenCalled();
    expect(rootState()).toEqual(Object.fromEntries(ATTRIBUTES.map((name) => [name, null])));
  });
});
