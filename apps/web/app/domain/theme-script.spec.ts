/// <reference types="node" />
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import {
  loadPreferences,
  PREFERENCES_STORAGE_KEY,
  serializePreferences,
  type PreferencesStorage,
  type SystemPreferences,
} from './preferences.js';
import { DARK_QUERY, REDUCED_MOTION_QUERY, rootAttributes } from './root-attributes.js';
import { THEME_SCRIPT_SHA256, themeScript, themeScriptConfig } from './theme-script.js';

// Le script de thème (D5) est exécuté tel qu'il sera posé dans la page, dans un contexte isolé qui
// imite le navigateur (document, matchMedia, localStorage) ; son résultat est comparé à celui du
// montage (`rootAttributes(loadPreferences(…))`) pour chaque stockage et chaque système.

const ATTRIBUTES = [
  'data-theme',
  'data-contrast',
  'data-text-size',
  'data-font',
  'data-spacing',
  'data-links',
  'data-motion',
];

const SYSTEMS: readonly SystemPreferences[] = [
  { prefersDark: false, prefersReducedMotion: false },
  { prefersDark: true, prefersReducedMotion: false },
  { prefersDark: false, prefersReducedMotion: true },
  { prefersDark: true, prefersReducedMotion: true },
];

/** Racine factice : les attributs posés, et des valeurs périmées au départ (à remplacer ou retirer). */
class FakeRoot {
  readonly attributes = new Map<string, string>(ATTRIBUTES.map((name) => [name, 'perime']));

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  snapshot(): Record<string, string | null> {
    return Object.fromEntries(ATTRIBUTES.map((name) => [name, this.attributes.get(name) ?? null]));
  }
}

type StorageCase =
  | { kind: 'value'; raw: string | null }
  | { kind: 'getItem-throws' }
  | { kind: 'localStorage-throws' };

interface RunOptions {
  storage: StorageCase;
  system: SystemPreferences;
  matchMediaThrows?: boolean;
}

/** Exécute le script dans un contexte neuf ; rend les attributs de la racine et les clés lues. */
function run({ storage, system, matchMediaThrows = false }: RunOptions): {
  attributes: Record<string, string | null>;
  keys: string[];
} {
  const root = new FakeRoot();
  const keys: string[] = [];
  const sandbox: Record<string, unknown> = {
    document: { documentElement: root },
    matchMedia: (query: string) => {
      if (matchMediaThrows) throw new Error('matchMedia indisponible');
      return {
        matches:
          (query === DARK_QUERY && system.prefersDark) ||
          (query === REDUCED_MOTION_QUERY && system.prefersReducedMotion),
      };
    },
  };
  if (storage.kind === 'localStorage-throws') {
    Object.defineProperty(sandbox, 'localStorage', {
      get: () => {
        throw new Error('SecurityError');
      },
    });
  } else {
    sandbox['localStorage'] = {
      getItem: (key: string) => {
        keys.push(key);
        if (storage.kind === 'getItem-throws') throw new Error('stockage refusé');
        return storage.raw;
      },
    };
  }
  runInNewContext(themeScript(), sandbox);
  return { attributes: root.snapshot(), keys };
}

/** Ce que pose le montage (`usePreferencesSync`) pour le même stockage et le même système. */
function expected(storage: StorageCase, system: SystemPreferences): Record<string, string | null> {
  const store: PreferencesStorage | null =
    storage.kind === 'localStorage-throws'
      ? null
      : {
          getItem: () => {
            if (storage.kind === 'getItem-throws') throw new Error('stockage refusé');
            return storage.raw;
          },
          setItem: () => undefined,
        };
  const attributes = rootAttributes(loadPreferences(store, system).preferences);
  return Object.fromEntries(ATTRIBUTES.map((name) => [name, attributes[name] ?? null]));
}

const stored = (document: Record<string, unknown>): StorageCase => ({
  kind: 'value',
  raw: JSON.stringify(document),
});

const STORAGE_CASES: Record<string, StorageCase> = {
  'rien d’enregistré': { kind: 'value', raw: null },
  'localStorage inaccessible': { kind: 'localStorage-throws' },
  'getItem lève': { kind: 'getItem-throws' },
  'texte qui n’est pas du JSON': { kind: 'value', raw: '{thème' },
  'JSON null': { kind: 'value', raw: 'null' },
  'JSON nombre': { kind: 'value', raw: '1' },
  'JSON tableau': { kind: 'value', raw: '[1]' },
  'JSON chaîne': { kind: 'value', raw: '"clair"' },
  'sans version': stored({ theme: 'clair', textSize: 130, highContrast: true }),
  'version 2': stored({ version: 2, theme: 'clair', textSize: 130, highContrast: true }),
  'version en texte': stored({ version: '1', theme: 'clair', textSize: 130 }),
  'document complet, tout activé': {
    kind: 'value',
    raw: serializePreferences({
      theme: 'clair',
      textSize: 130,
      highContrast: true,
      readableFont: true,
      textSpacing: true,
      underlineLinks: true,
      reduceMotion: true,
    }),
  },
  'document complet, tout désactivé': {
    kind: 'value',
    raw: serializePreferences({
      theme: 'sombre',
      textSize: 100,
      highContrast: false,
      readableFont: false,
      textSpacing: false,
      underlineLinks: false,
      reduceMotion: false,
    }),
  },
  'taille 115 seule': stored({ version: 1, textSize: 115 }),
  'thème clair seul': stored({ version: 1, theme: 'clair' }),
  'animations réduites seules': stored({ version: 1, reduceMotion: true }),
  'animations explicitement normales': stored({ version: 1, reduceMotion: false }),
  'champs invalides': stored({
    version: 1,
    theme: 'bleu',
    textSize: 120,
    highContrast: 'oui',
    readableFont: 1,
    textSpacing: null,
    underlineLinks: [true],
    reduceMotion: 'true',
  }),
  'taille en texte': stored({ version: 1, textSize: '130', underlineLinks: true }),
  'mélange de valides et d’invalides': stored({
    version: 1,
    theme: 'clair',
    textSize: 99,
    readableFont: true,
    textSpacing: 'oui',
  }),
};

describe('script de thème (D5)', () => {
  for (const [name, storage] of Object.entries(STORAGE_CASES)) {
    it(`pose les mêmes attributs que le montage : ${name}, dans les quatre états du système`, () => {
      for (const system of SYSTEMS) {
        expect(run({ storage, system }).attributes, JSON.stringify(system)).toEqual(
          expected(storage, system),
        );
      }
    });
  }

  it('lit la clé de stockage des préférences', () => {
    const { keys } = run({ storage: { kind: 'value', raw: null }, system: SYSTEMS[0]! });

    expect(keys).toEqual([PREFERENCES_STORAGE_KEY]);
  });

  it('sans stockage, suit le système : thème et animations (témoin des valeurs attendues)', () => {
    const empty: StorageCase = { kind: 'value', raw: null };

    expect(run({ storage: empty, system: SYSTEMS[0]! }).attributes).toEqual({
      'data-theme': 'clair',
      'data-contrast': null,
      'data-text-size': '100',
      'data-font': null,
      'data-spacing': null,
      'data-links': null,
      'data-motion': 'normal',
    });
    expect(run({ storage: empty, system: SYSTEMS[3]! }).attributes).toMatchObject({
      'data-theme': 'sombre',
      'data-motion': 'reduit',
    });
  });

  it('applique un réglage enregistré même s’il contredit le système (témoin)', () => {
    const attributes = run({
      storage: STORAGE_CASES['document complet, tout activé']!,
      system: SYSTEMS[1]!,
    }).attributes;

    expect(attributes).toEqual({
      'data-theme': 'clair',
      'data-contrast': 'renforce',
      'data-text-size': '130',
      'data-font': 'lisible',
      'data-spacing': 'augmente',
      'data-links': 'soulignes',
      'data-motion': 'reduit',
    });
  });

  it('ne lève jamais : sans matchMedia, la racine reste telle quelle', () => {
    const { attributes } = run({
      storage: { kind: 'value', raw: null },
      system: SYSTEMS[0]!,
      matchMediaThrows: true,
    });

    expect(attributes).toEqual(Object.fromEntries(ATTRIBUTES.map((name) => [name, 'perime'])));
  });

  it('ne lève pas sans document', () => {
    expect(() => {
      runInNewContext(themeScript(), {});
    }).not.toThrow();
  });

  it('embarque la table, la clé, la version et les valeurs par défaut du domaine', () => {
    const config = themeScriptConfig();

    expect(themeScript()).toContain(JSON.stringify(config));
    expect(config).toMatchObject({
      key: 'siteperso:preferences',
      version: 1,
      dark: DARK_QUERY,
      reduce: REDUCED_MOTION_QUERY,
      allowed: { theme: ['sombre', 'clair'], textSize: [100, 115, 130] },
    });
  });

  it('ne contient ni « < » ni retour à la ligne : posé tel quel dans le HTML, empreinte stable', () => {
    expect(themeScript()).not.toMatch(/[<\n\r]/);
  });

  it('a pour empreinte CSP THEME_SCRIPT_SHA256 (à reporter dans la CSP si le script change)', () => {
    const digest = createHash('sha256').update(themeScript(), 'utf8').digest('base64');

    expect(THEME_SCRIPT_SHA256).toBe(`sha256-${digest}`);
  });
});
