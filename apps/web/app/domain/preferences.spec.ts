import { describe, expect, it } from 'vitest';
import {
  PREFERENCES_STORAGE_KEY,
  PREFERENCES_VERSION,
  TEXT_SIZES,
  THEMES,
  defaultPreferences,
  loadPreferences,
  parsePreferences,
  resetPreferences,
  savePreferences,
  serializePreferences,
  type Preferences,
  type PreferencesStorage,
  type SystemPreferences,
} from './preferences.js';

const LIGHT_SYSTEM: SystemPreferences = { prefersDark: false, prefersReducedMotion: false };
const DARK_SYSTEM: SystemPreferences = { prefersDark: true, prefersReducedMotion: false };
const REDUCED_SYSTEM: SystemPreferences = { prefersDark: false, prefersReducedMotion: true };

/** Tous les réglages à l'opposé des valeurs par défaut d'un système clair. */
const CUSTOM: Preferences = {
  theme: 'sombre',
  textSize: 130,
  highContrast: true,
  readableFont: true,
  textSpacing: true,
  underlineLinks: true,
  reduceMotion: true,
};

/** Valeurs par défaut d'un système sombre qui demande aussi des animations réduites. */
const DARK_DEFAULTS: Preferences = {
  ...defaultPreferences(DARK_SYSTEM),
  reduceMotion: true,
};

class MemoryStorage implements PreferencesStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

function storageWith(value: string | null): MemoryStorage {
  const storage = new MemoryStorage();
  if (value !== null) storage.items.set(PREFERENCES_STORAGE_KEY, value);
  return storage;
}

function stored(fields: object): string {
  return JSON.stringify({ version: PREFERENCES_VERSION, ...fields });
}

describe('constantes', () => {
  it('liste les thèmes et les tailles de la spécification', () => {
    expect(THEMES).toEqual(['sombre', 'clair']);
    expect(TEXT_SIZES).toEqual([100, 115, 130]);
    expect(PREFERENCES_VERSION).toBe(1);
    expect(PREFERENCES_STORAGE_KEY).toBe('siteperso:preferences');
  });
});

describe('defaultPreferences', () => {
  it('suit un système clair sans réduction des animations', () => {
    expect(defaultPreferences(LIGHT_SYSTEM)).toEqual({
      theme: 'clair',
      textSize: 100,
      highContrast: false,
      readableFont: false,
      textSpacing: false,
      underlineLinks: false,
      reduceMotion: false,
    });
  });

  it('prend le thème sombre quand le système est sombre', () => {
    expect(defaultPreferences(DARK_SYSTEM).theme).toBe('sombre');
  });

  it('active la réduction des animations quand le système la demande', () => {
    const preferences = defaultPreferences(REDUCED_SYSTEM);
    expect(preferences.reduceMotion).toBe(true);
    expect(preferences.theme).toBe('clair');
  });

  it('ne touche à aucun autre réglage selon le système', () => {
    const { theme, reduceMotion, ...others } = defaultPreferences({
      prefersDark: true,
      prefersReducedMotion: true,
    });
    expect([theme, reduceMotion]).toEqual(['sombre', true]);
    expect(others).toEqual({
      textSize: 100,
      highContrast: false,
      readableFont: false,
      textSpacing: false,
      underlineLinks: false,
    });
  });
});

describe('serializePreferences', () => {
  it('écrit un document JSON versionné avec chaque réglage', () => {
    expect(JSON.parse(serializePreferences(CUSTOM))).toEqual({
      version: 1,
      theme: 'sombre',
      textSize: 130,
      highContrast: true,
      readableFont: true,
      textSpacing: true,
      underlineLinks: true,
      reduceMotion: true,
    });
  });

  it('se relit à l’identique', () => {
    expect(
      parsePreferences(serializePreferences(CUSTOM), defaultPreferences(LIGHT_SYSTEM)),
    ).toEqual(CUSTOM);
  });
});

describe('parsePreferences', () => {
  const defaults = defaultPreferences(LIGHT_SYSTEM);

  it('relit chaque réglage stocké, qui l’emporte sur les valeurs par défaut', () => {
    expect(parsePreferences(stored(CUSTOM), defaults)).toEqual(CUSTOM);
  });

  it('accepte chaque thème et chaque taille connus', () => {
    for (const theme of THEMES) {
      expect(parsePreferences(stored({ theme }), DARK_DEFAULTS)?.theme).toBe(theme);
    }
    for (const textSize of TEXT_SIZES) {
      expect(parsePreferences(stored({ textSize }), defaults)?.textSize).toBe(textSize);
    }
  });

  it('rend null pour du texte qui n’est pas du JSON', () => {
    expect(parsePreferences('{theme:', defaults)).toBeNull();
    expect(parsePreferences('', defaults)).toBeNull();
  });

  it('rend null quand il n’y a rien (null)', () => {
    expect(parsePreferences(null, defaults)).toBeNull();
  });

  it('rend null pour un JSON qui n’est pas un objet versionné', () => {
    for (const text of ['null', '12', '"sombre"', 'true', '[]', '[1]', '{}']) {
      expect(parsePreferences(text, defaults), text).toBeNull();
    }
  });

  it('rend null pour une autre version (ancienne ou future)', () => {
    for (const version of [0, 2, '1', null]) {
      expect(parsePreferences(JSON.stringify({ ...CUSTOM, version }), defaults)).toBeNull();
    }
  });

  it('remplace un champ invalide par la valeur par défaut sans perdre les autres', () => {
    const parsed = parsePreferences(
      stored({
        theme: 'bleu',
        textSize: 120,
        highContrast: 'oui',
        readableFont: true,
        textSpacing: 1,
        underlineLinks: null,
        reduceMotion: 'true',
      }),
      DARK_DEFAULTS,
    );
    expect(parsed).toEqual({
      theme: 'sombre',
      textSize: 100,
      highContrast: false,
      readableFont: true,
      textSpacing: false,
      underlineLinks: false,
      reduceMotion: true,
    });
  });

  it('complète les champs absents avec les valeurs par défaut', () => {
    expect(parsePreferences(stored({}), DARK_DEFAULTS)).toEqual(DARK_DEFAULTS);
  });

  it('ne reconnaît pas une taille de texte donnée sous forme de texte', () => {
    expect(parsePreferences(stored({ textSize: '115' }), defaults)?.textSize).toBe(100);
  });
});

describe('loadPreferences', () => {
  it('relit les préférences stockées (restored)', () => {
    const result = loadPreferences(storageWith(serializePreferences(CUSTOM)), LIGHT_SYSTEM);
    expect(result).toEqual({ preferences: CUSTOM, status: 'restored' });
  });

  it('lit la clé documentée', () => {
    const reads: string[] = [];
    const storage: PreferencesStorage = {
      getItem: (key) => {
        reads.push(key);
        return null;
      },
      setItem: () => undefined,
    };
    loadPreferences(storage, LIGHT_SYSTEM);
    expect(reads).toEqual(['siteperso:preferences']);
  });

  it('prend les valeurs système quand rien n’est stocké (empty)', () => {
    expect(loadPreferences(storageWith(null), DARK_SYSTEM)).toEqual({
      preferences: defaultPreferences(DARK_SYSTEM),
      status: 'empty',
    });
  });

  it('prend les valeurs système pour une valeur corrompue (invalid)', () => {
    expect(loadPreferences(storageWith('{"version":'), REDUCED_SYSTEM)).toEqual({
      preferences: defaultPreferences(REDUCED_SYSTEM),
      status: 'invalid',
    });
  });

  it('prend les valeurs système pour une ancienne version (invalid)', () => {
    const legacy = JSON.stringify({ ...CUSTOM, version: 0 });
    expect(loadPreferences(storageWith(legacy), LIGHT_SYSTEM)).toEqual({
      preferences: defaultPreferences(LIGHT_SYSTEM),
      status: 'invalid',
    });
  });

  it('tolère l’absence de stockage (unavailable)', () => {
    const expected = { preferences: defaultPreferences(DARK_SYSTEM), status: 'unavailable' };
    expect(loadPreferences(null, DARK_SYSTEM)).toEqual(expected);
    expect(loadPreferences(undefined, DARK_SYSTEM)).toEqual(expected);
  });

  it('tolère un stockage qui lève (error)', () => {
    const storage: PreferencesStorage = {
      getItem: () => {
        throw new DOMException('accès refusé', 'SecurityError');
      },
      setItem: () => undefined,
    };
    expect(loadPreferences(storage, DARK_SYSTEM)).toEqual({
      preferences: defaultPreferences(DARK_SYSTEM),
      status: 'error',
    });
  });
});

describe('savePreferences', () => {
  it('écrit le document versionné sous la clé documentée (saved)', () => {
    const storage = new MemoryStorage();
    expect(savePreferences(storage, CUSTOM)).toBe('saved');
    expect([...storage.items.keys()]).toEqual(['siteperso:preferences']);
    expect(storage.items.get('siteperso:preferences')).toBe(serializePreferences(CUSTOM));
  });

  it('relit ce qu’il a écrit', () => {
    const storage = new MemoryStorage();
    savePreferences(storage, CUSTOM);
    expect(loadPreferences(storage, LIGHT_SYSTEM)).toEqual({
      preferences: CUSTOM,
      status: 'restored',
    });
  });

  it('tolère l’absence de stockage (unavailable)', () => {
    expect(savePreferences(null, CUSTOM)).toBe('unavailable');
    expect(savePreferences(undefined, CUSTOM)).toBe('unavailable');
  });

  it('tolère un stockage qui refuse l’écriture (error)', () => {
    const storage: PreferencesStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota dépassé', 'QuotaExceededError');
      },
    };
    expect(savePreferences(storage, CUSTOM)).toBe('error');
  });
});

describe('resetPreferences', () => {
  it('rend les valeurs par défaut du système et les écrit à la place des réglages', () => {
    const storage = storageWith(serializePreferences(CUSTOM));
    const preferences = resetPreferences(storage, DARK_SYSTEM);
    expect(preferences).toEqual(defaultPreferences(DARK_SYSTEM));
    expect(loadPreferences(storage, LIGHT_SYSTEM)).toEqual({
      preferences: defaultPreferences(DARK_SYSTEM),
      status: 'restored',
    });
  });

  it('rend les valeurs par défaut même sans stockage ou avec un stockage qui refuse', () => {
    expect(resetPreferences(null, REDUCED_SYSTEM)).toEqual(defaultPreferences(REDUCED_SYSTEM));
    const refusing: PreferencesStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('refusé');
      },
    };
    expect(resetPreferences(refusing, REDUCED_SYSTEM)).toEqual(defaultPreferences(REDUCED_SYSTEM));
  });
});
