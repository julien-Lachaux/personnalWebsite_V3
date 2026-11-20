// État partagé des préférences d'affichage et d'accessibilité (SPEC § 9, § 10.1). Le domaine décide
// (`domain/preferences` : valeurs par défaut, lecture, écriture, suppression) ; ce composable relie
// l'état de Nuxt (`useState`, partagé entre les composants et sérialisé dans la page générée) et le
// stockage du navigateur. Aucun accès au DOM à l'appel : le stockage n'est touché que par les actions
// (événements) et par `hydrate` (appelée au montage par `usePreferencesSync`).
import { computed, type ComputedRef } from 'vue';
import { useState } from '#imports';

import {
  clearPreferences,
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type Preferences,
  type RemovablePreferencesStorage,
  type SystemPreferences,
} from '../../domain/preferences.js';

/** Clé de l'état partagé de Nuxt. */
export const PREFERENCES_STATE_KEY = 'shell:preferences';

/**
 * Système supposé au rendu statique (aucune information avant le montage) : thème sombre, animations
 * normales, comme la maquette.
 */
export const SERVER_SYSTEM: SystemPreferences = { prefersDark: true, prefersReducedMotion: false };

export interface PreferencesState {
  preferences: Preferences;
  /** Dernières préférences du système lues par `hydrate` ou `followSystem`. */
  system: SystemPreferences;
  /** Rien n'est enregistré : thème et animations suivent le système (D11). */
  followsSystem: boolean;
}

/** `window.localStorage`, ou `null` quand il n'y en a pas (rendu statique) ou qu'il est inaccessible. */
export function browserStorage(): RemovablePreferencesStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface UsePreferences {
  preferences: ComputedRef<Preferences>;
  followsSystem: ComputedRef<boolean>;
  /** Change un réglage et enregistre tous les réglages : le système cesse d'être suivi. */
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  /** Bascule sombre/clair et l'enregistre. */
  toggleTheme: () => void;
  /** Supprime le réglage enregistré (D11) : les valeurs du système reviennent. */
  reset: () => void;
  /** Lit le stockage avec les préférences système données (montage). */
  hydrate: (system: SystemPreferences) => void;
  /** Un changement du système : suivi seulement quand rien n'est enregistré. */
  followSystem: (system: SystemPreferences) => void;
}

export function usePreferences(): UsePreferences {
  const state = useState<PreferencesState>(PREFERENCES_STATE_KEY, () => ({
    preferences: defaultPreferences(SERVER_SYSTEM),
    system: SERVER_SYSTEM,
    followsSystem: true,
  }));

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    const preferences = { ...state.value.preferences, [key]: value };
    state.value = { ...state.value, preferences, followsSystem: false };
    savePreferences(browserStorage(), preferences);
  }

  function toggleTheme(): void {
    set('theme', state.value.preferences.theme === 'sombre' ? 'clair' : 'sombre');
  }

  function reset(): void {
    clearPreferences(browserStorage());
    state.value = {
      ...state.value,
      preferences: defaultPreferences(state.value.system),
      followsSystem: true,
    };
  }

  function hydrate(system: SystemPreferences): void {
    const { preferences, status } = loadPreferences(browserStorage(), system);
    state.value = { preferences, system, followsSystem: status !== 'restored' };
  }

  function followSystem(system: SystemPreferences): void {
    state.value = {
      ...state.value,
      system,
      preferences: state.value.followsSystem ? defaultPreferences(system) : state.value.preferences,
    };
  }

  return {
    preferences: computed(() => state.value.preferences),
    followsSystem: computed(() => state.value.followsSystem),
    set,
    toggleTheme,
    reset,
    hydrate,
    followSystem,
  };
}
