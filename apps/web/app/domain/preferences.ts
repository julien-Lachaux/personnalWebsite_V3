// Préférences d'affichage et d'accessibilité (SPEC § 9 et § 10.1) : modèle, valeurs initiales tirées
// des préférences système, lecture et écriture dans un stockage injecté (`getItem` / `setItem`).
// Module pur : il ne connaît ni `window`, ni `localStorage`, ni le DOM. L'appelant fournit le stockage
// (ou `null` quand il n'y en a pas : rendu statique, navigation privée) et applique les valeurs
// rendues sur la racine du document.

/** Valeurs de `data-theme` (SPEC § 9). */
export const THEMES = ['sombre', 'clair'] as const;
/** Tailles du texte, en pourcentage de la taille de base (SPEC § 10.1). */
export const TEXT_SIZES = [100, 115, 130] as const;

export type Theme = (typeof THEMES)[number];
export type TextSize = (typeof TEXT_SIZES)[number];

export interface Preferences {
  theme: Theme;
  textSize: TextSize;
  /** Palette `highContrast` des tokens. */
  highContrast: boolean;
  /** Police Atkinson Hyperlegible. */
  readableFont: boolean;
  /** Interligne 1,5, lettres 0,12 em, mots 0,16 em (WCAG 1.4.12). */
  textSpacing: boolean;
  underlineLinks: boolean;
  reduceMotion: boolean;
}

/** Préférences système, lues par l'appelant avec `matchMedia`. */
export interface SystemPreferences {
  /** `prefers-color-scheme: dark` */
  prefersDark: boolean;
  /** `prefers-reduced-motion: reduce` */
  prefersReducedMotion: boolean;
}

/** Sous-ensemble de l'API `Storage` du navigateur. */
export interface PreferencesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * `PreferencesStorage` avec suppression (décision D11 : « Réinitialiser » supprime le réglage
 * enregistré). `window.localStorage` la satisfait ; `PreferencesStorage` reste le contrat minimal de
 * lecture et d'écriture.
 */
export interface RemovablePreferencesStorage extends PreferencesStorage {
  removeItem(key: string): void;
}

/** Clé unique du stockage : un seul document JSON versionné. */
export const PREFERENCES_STORAGE_KEY = 'siteperso:preferences';
/** Version du format stocké ; une autre version est ignorée (valeurs par défaut). */
export const PREFERENCES_VERSION = 1;

/**
 * - `restored` : un document valide a été lu ;
 * - `empty` : rien n'est stocké ;
 * - `invalid` : un document est stocké mais illisible ou d'une autre version ;
 * - `unavailable` : pas de stockage (`null` ou `undefined`) ;
 * - `error` : le stockage a levé une erreur.
 * Hors `restored`, les préférences rendues sont les valeurs par défaut.
 */
export type LoadStatus = 'restored' | 'empty' | 'invalid' | 'unavailable' | 'error';
export interface LoadResult {
  preferences: Preferences;
  status: LoadStatus;
}
/** `unavailable` : pas de stockage ; `error` : le stockage a refusé l'écriture (quota, mode privé). */
export type SaveStatus = 'saved' | 'unavailable' | 'error';
/** `unavailable` : pas de stockage ; `error` : le stockage a refusé la suppression. */
export type ClearStatus = 'cleared' | 'unavailable' | 'error';

/**
 * Valeurs initiales : thème et animations suivent le système, le reste est désactivé
 * (SPEC § 9 : thème selon `prefers-color-scheme` ; § 10.1 : animations réduites par défaut si
 * `prefers-reduced-motion`).
 */
export function defaultPreferences(system: SystemPreferences): Preferences {
  return {
    theme: system.prefersDark ? 'sombre' : 'clair',
    textSize: 100,
    highContrast: false,
    readableFont: false,
    textSpacing: false,
    underlineLinks: false,
    reduceMotion: system.prefersReducedMotion,
  };
}

/** Document JSON versionné, prêt pour `setItem`. */
export function serializePreferences(preferences: Preferences): string {
  return JSON.stringify({
    version: PREFERENCES_VERSION,
    theme: preferences.theme,
    textSize: preferences.textSize,
    highContrast: preferences.highContrast,
    readableFont: preferences.readableFont,
    textSpacing: preferences.textSpacing,
    underlineLinks: preferences.underlineLinks,
    reduceMotion: preferences.reduceMotion,
  });
}

/**
 * Rend `null` quand le texte n'est pas du JSON. Un JSON scalaire ou un tableau n'a pas de propriété
 * `version` : il est refusé plus loin comme tout document sans la bonne version.
 */
function parseJson(text: string): Partial<Record<string, unknown>> | null {
  try {
    return JSON.parse(text) as Partial<Record<string, unknown>> | null;
  } catch {
    return null;
  }
}

function oneOf<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Relit un document stocké. Rend `null` quand il est illisible ou d'une autre version. Un document
 * de la bonne version dont un champ est absent ou invalide garde la valeur de `defaults` pour ce
 * champ : une altération partielle ne fait pas perdre les autres réglages.
 */
export function parsePreferences(raw: string | null, defaults: Preferences): Preferences | null {
  // `String(null)` vaut « null » : JSON valide, sans version, donc refusé comme le reste.
  const data = parseJson(String(raw));
  if (data === null) return null;
  if (data['version'] !== PREFERENCES_VERSION) return null;
  return {
    theme: oneOf(THEMES, data['theme'], defaults.theme),
    textSize: oneOf(TEXT_SIZES, data['textSize'], defaults.textSize),
    highContrast: flag(data['highContrast'], defaults.highContrast),
    readableFont: flag(data['readableFont'], defaults.readableFont),
    textSpacing: flag(data['textSpacing'], defaults.textSpacing),
    underlineLinks: flag(data['underlineLinks'], defaults.underlineLinks),
    reduceMotion: flag(data['reduceMotion'], defaults.reduceMotion),
  };
}

/** Lit les préférences stockées ; ne lève jamais (stockage absent, qui lève, valeur corrompue). */
export function loadPreferences(
  storage: PreferencesStorage | null | undefined,
  system: SystemPreferences,
): LoadResult {
  const defaults = defaultPreferences(system);
  if (!storage) return { preferences: defaults, status: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(PREFERENCES_STORAGE_KEY);
  } catch {
    return { preferences: defaults, status: 'error' };
  }
  if (raw === null) return { preferences: defaults, status: 'empty' };
  const stored = parsePreferences(raw, defaults);
  return stored === null
    ? { preferences: defaults, status: 'invalid' }
    : { preferences: stored, status: 'restored' };
}

/** Écrit les préférences ; ne lève jamais. */
export function savePreferences(
  storage: PreferencesStorage | null | undefined,
  preferences: Preferences,
): SaveStatus {
  if (!storage) return 'unavailable';
  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(preferences));
  } catch {
    return 'error';
  }
  return 'saved';
}

/**
 * Supprime le réglage enregistré (décision D11, bouton « Réinitialiser ») : le site suit de nouveau
 * le système tant que l'utilisateur ne choisit rien. Ne lève jamais.
 */
export function clearPreferences(
  storage: RemovablePreferencesStorage | null | undefined,
): ClearStatus {
  if (!storage) return 'unavailable';
  try {
    storage.removeItem(PREFERENCES_STORAGE_KEY);
  } catch {
    return 'error';
  }
  return 'cleared';
}
