// Script de thème sans flash (décision D5, F3-01) : un court script en ligne, en tête de page, qui
// pose les attributs de `<html>` (thème, contraste, taille du texte, police, espacement, liens,
// animations) AVANT le premier affichage, depuis le réglage enregistré par le site
// (`localStorage['siteperso:preferences']`, document `{ version: 1, … }` de `preferences.ts`) et les
// préférences du système. Le montage (`usePreferencesSync`) pose ensuite exactement les mêmes valeurs :
// rien ne bouge à l'hydratation.
//
// Aucune règle n'est recopiée à la main : le script embarque, en JSON, la table des attributs
// (`ROOT_ATTRIBUTE_TABLE`), la clé et la version du stockage, les valeurs admises (`THEMES`,
// `TEXT_SIZES`) et les valeurs par défaut calculées par `defaultPreferences` pour les quatre états du
// système. Son code ne fait que lire et appliquer ; `theme-script.spec.ts` l'exécute et vérifie qu'il
// rend, pour chaque stockage et chaque système, les attributs de `rootAttributes(loadPreferences(…))`.
// Tolérant : sans stockage, avec un document illisible ou une erreur quelconque, il garde les valeurs
// par défaut du système ou ne fait rien ; il ne lève jamais.
//
// CSP (F9) : le script est autorisé par son empreinte, `THEME_SCRIPT_SHA256` ; toute modification du
// texte change l'empreinte (le test le rappelle) et doit être reportée dans la CSP.
import {
  defaultPreferences,
  PREFERENCES_STORAGE_KEY,
  PREFERENCES_VERSION,
  TEXT_SIZES,
  THEMES,
} from './preferences.js';
import { DARK_QUERY, REDUCED_MOTION_QUERY, ROOT_ATTRIBUTE_TABLE } from './root-attributes.js';

/** Configuration embarquée (JSON) : tout ce que le script sait vient d'ici. */
export function themeScriptConfig(): Record<string, unknown> {
  return {
    key: PREFERENCES_STORAGE_KEY,
    version: PREFERENCES_VERSION,
    dark: DARK_QUERY,
    reduce: REDUCED_MOTION_QUERY,
    allowed: { theme: THEMES, textSize: TEXT_SIZES },
    // Indice : 1 si le système est sombre, + 2 s'il demande moins d'animations.
    defaults: [
      defaultPreferences({ prefersDark: false, prefersReducedMotion: false }),
      defaultPreferences({ prefersDark: true, prefersReducedMotion: false }),
      defaultPreferences({ prefersDark: false, prefersReducedMotion: true }),
      defaultPreferences({ prefersDark: true, prefersReducedMotion: true }),
    ],
    table: ROOT_ATTRIBUTE_TABLE,
  };
}

// Code du script, en ES5 sans dépendance (il s'exécute avant tout module) ; `c` est la configuration.
// Un champ du document stocké n'est repris que s'il est admis (valeur de `allowed`, sinon booléen),
// comme `parsePreferences` : une altération partielle garde les autres réglages.
const RUNTIME =
  '(function(c){try{' +
  'var r=document.documentElement,' +
  'd=c.defaults[(matchMedia(c.dark).matches?1:0)+(matchMedia(c.reduce).matches?2:0)],' +
  'p={},k,i,s,v,t;' +
  'for(k in d)p[k]=d[k];' +
  'try{s=JSON.parse(localStorage.getItem(c.key));' +
  'if(s&&s.version===c.version)for(k in d){v=s[k];' +
  'if(c.allowed[k]?c.allowed[k].indexOf(v)!==-1:typeof v==="boolean")p[k]=v}}catch(e){}' +
  'for(i=0;i!==c.table.length;i++){t=c.table[i];' +
  'v="on" in t?(p[t.key]?t.on:t.off):String(p[t.key]);' +
  'if(v===null)r.removeAttribute(t.attribute);else r.setAttribute(t.attribute,v)}' +
  '}catch(e){}})';

/** Texte du script en ligne, tel qu'il est posé dans `<head>` (nuxt.config.ts). */
export function themeScript(): string {
  return `${RUNTIME}(${JSON.stringify(themeScriptConfig())})`;
}

/**
 * Empreinte du script pour la CSP (`script-src 'sha256-…'`, F9) : SHA-256 du texte exact, en base64.
 * Recalculée et comparée par `theme-script.spec.ts`.
 */
export const THEME_SCRIPT_SHA256 = 'sha256-nzuLVqI8ekzAXFcdRbwjQkxQig8MPDlNQ5+0PkfBJwY=';
