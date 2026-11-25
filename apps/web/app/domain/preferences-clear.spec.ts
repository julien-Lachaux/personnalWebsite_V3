import { describe, expect, it } from 'vitest';
import {
  PREFERENCES_STORAGE_KEY,
  clearPreferences,
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type Preferences,
  type RemovablePreferencesStorage,
  type SystemPreferences,
} from './preferences.js';

// Décision D11 : « Réinitialiser » supprime le réglage enregistré, le site suit de nouveau le système.

const LIGHT_SYSTEM: SystemPreferences = { prefersDark: false, prefersReducedMotion: false };
const DARK_SYSTEM: SystemPreferences = { prefersDark: true, prefersReducedMotion: true };

const CUSTOM: Preferences = {
  theme: 'sombre',
  textSize: 130,
  highContrast: true,
  readableFont: true,
  textSpacing: true,
  underlineLinks: true,
  reduceMotion: true,
};

class MemoryStorage implements RemovablePreferencesStorage {
  readonly items = new Map<string, string>();
  readonly removed: string[] = [];
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.removed.push(key);
    this.items.delete(key);
  }
}

describe('clearPreferences', () => {
  it('supprime le document des préférences, et lui seul', () => {
    const storage = new MemoryStorage();
    savePreferences(storage, CUSTOM);
    storage.items.set('autre-cle', 'valeur');

    expect(clearPreferences(storage)).toBe('cleared');

    expect(storage.removed).toEqual([PREFERENCES_STORAGE_KEY]);
    expect(storage.items.has(PREFERENCES_STORAGE_KEY)).toBe(false);
    expect(storage.items.get('autre-cle')).toBe('valeur');
  });

  it('rend le site au système : plus rien de stocké, valeurs par défaut du système courant', () => {
    const storage = new MemoryStorage();
    savePreferences(storage, CUSTOM);

    clearPreferences(storage);

    expect(loadPreferences(storage, LIGHT_SYSTEM)).toEqual({
      preferences: defaultPreferences(LIGHT_SYSTEM),
      status: 'empty',
    });
    expect(loadPreferences(storage, DARK_SYSTEM)).toEqual({
      preferences: defaultPreferences(DARK_SYSTEM),
      status: 'empty',
    });
  });

  it('réussit aussi quand rien n’est stocké', () => {
    expect(clearPreferences(new MemoryStorage())).toBe('cleared');
  });

  it('signale l’absence de stockage sans lever', () => {
    expect(clearPreferences(null)).toBe('unavailable');
    expect(clearPreferences(undefined)).toBe('unavailable');
  });

  it('signale un stockage qui refuse la suppression, sans lever', () => {
    const refusing: RemovablePreferencesStorage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error('refusé');
      },
    };

    expect(clearPreferences(refusing)).toBe('error');
  });
});
