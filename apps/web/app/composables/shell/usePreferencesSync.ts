// Branche les préférences sur le navigateur (à appeler UNE fois, dans la coquille) : au montage, lit
// le système (`matchMedia`) et le stockage, pose les attributs de `<html>` décrits en tête de
// `assets/css/tokens.css`, puis les tient à jour à chaque changement de réglage et à chaque changement
// des préférences du système (tant que rien n'est enregistré, D11). Les écouteurs sont retirés au
// démontage. Rien n'est lu ni écrit avant le montage : aucun accès au DOM pendant le rendu serveur.
import { onBeforeUnmount, onMounted, watch } from 'vue';

import type { Preferences, SystemPreferences } from '../../domain/preferences.js';
import { usePreferences } from './usePreferences.js';

export const DARK_QUERY = '(prefers-color-scheme: dark)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Valeur de chaque attribut de `<html>` ; `null` : attribut retiré. */
export type RootAttributes = Record<string, string | null>;

/** Interface préférences → CSS (tête de tokens.css) : les seuls attributs que la CSS lit. */
export function rootAttributes(preferences: Preferences): RootAttributes {
  return {
    'data-theme': preferences.theme,
    'data-contrast': preferences.highContrast ? 'renforce' : null,
    'data-text-size': String(preferences.textSize),
    'data-font': preferences.readableFont ? 'lisible' : null,
    'data-spacing': preferences.textSpacing ? 'augmente' : null,
    'data-links': preferences.underlineLinks ? 'soulignes' : null,
    'data-motion': preferences.reduceMotion ? 'reduit' : 'normal',
  };
}

/** Pose (ou retire) les attributs sur l'élément. */
export function applyRootAttributes(root: Element, attributes: RootAttributes): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
}

export function usePreferencesSync(): void {
  const { preferences, hydrate, followSystem } = usePreferences();

  onMounted(() => {
    const dark = window.matchMedia(DARK_QUERY);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const readSystem = (): SystemPreferences => ({
      prefersDark: dark.matches,
      prefersReducedMotion: reducedMotion.matches,
    });
    const apply = (): void =>
      applyRootAttributes(document.documentElement, rootAttributes(preferences.value));
    const onSystemChange = (): void => followSystem(readSystem());

    hydrate(readSystem());
    apply();
    const stopWatching = watch(preferences, apply, { flush: 'sync' });
    dark.addEventListener('change', onSystemChange);
    reducedMotion.addEventListener('change', onSystemChange);

    // Retrait enregistré au montage : un composant démonté avant d'être monté n'a rien à retirer.
    onBeforeUnmount(() => {
      stopWatching();
      dark.removeEventListener('change', onSystemChange);
      reducedMotion.removeEventListener('change', onSystemChange);
    });
  });
}
