// Interface préférences → CSS (tête de assets/css/tokens.css) : la table unique qui dit quel attribut
// de `<html>` porte quel réglage, et avec quelle valeur. Elle sert deux fois, sans copie : au montage
// (`usePreferencesSync`, par `rootAttributes`) et avant le premier affichage (script de thème D5,
// `theme-script.ts`, qui embarque cette table telle quelle). Module pur, sans DOM.
import type { Preferences } from './preferences.js';

/** Requêtes média des préférences du système lues au montage et par le script de thème. */
export const DARK_QUERY = '(prefers-color-scheme: dark)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Valeur de chaque attribut de `<html>` ; `null` : attribut retiré. */
export type RootAttributes = Record<string, string | null>;

type FlagKey = {
  [K in keyof Preferences]: Preferences[K] extends boolean ? K : never;
}[keyof Preferences];

/** Ligne de la table : un réglage écrit tel quel (`value`) ou un interrupteur (`on` / `off`). */
export type RootAttributeRow =
  | { readonly attribute: string; readonly key: Exclude<keyof Preferences, FlagKey> }
  | {
      readonly attribute: string;
      readonly key: FlagKey;
      readonly on: string;
      readonly off: string | null;
    };

/** Les seuls attributs que la CSS lit (tokens.css, base.css). */
export const ROOT_ATTRIBUTE_TABLE: readonly RootAttributeRow[] = [
  { attribute: 'data-theme', key: 'theme' },
  { attribute: 'data-contrast', key: 'highContrast', on: 'renforce', off: null },
  { attribute: 'data-text-size', key: 'textSize' },
  { attribute: 'data-font', key: 'readableFont', on: 'lisible', off: null },
  { attribute: 'data-spacing', key: 'textSpacing', on: 'augmente', off: null },
  { attribute: 'data-links', key: 'underlineLinks', on: 'soulignes', off: null },
  { attribute: 'data-motion', key: 'reduceMotion', on: 'reduit', off: 'normal' },
];

/** Attributs de `<html>` pour des préférences, d'après la table. */
export function rootAttributes(preferences: Preferences): RootAttributes {
  return Object.fromEntries(
    ROOT_ATTRIBUTE_TABLE.map((row) => [
      row.attribute,
      'on' in row ? (preferences[row.key] ? row.on : row.off) : String(preferences[row.key]),
    ]),
  );
}
