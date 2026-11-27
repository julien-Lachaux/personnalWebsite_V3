// Lecture du CV pour une page (docs/04, F4-04) : le pont entre la source et `useAsyncData` de Nuxt,
// sans importer Nuxt. Les dépendances sont injectées ; `app/composables/use-cv.ts` (fichier partagé)
// les fournit avec `useAsyncData`, `useRuntimeConfig` et le `fetch` de Node (voir le compte rendu
// du lot F4).
import { type Cv, type Locale } from '@siteperso/contracts';

import { type FetchFn } from './cv-source.js';
import type { CvSourceSettings } from './select-cv-source.js';

/**
 * Ce que `useAsyncData` de Nuxt rend une fois attendu, réduit à ce dont on se sert ; `T` : la donnée
 * rangée dans la charge utile (le CV entier, ou ce qu'en garde `fetchCvValue`).
 */
export interface AsyncDataResult<T = Cv> {
  readonly data: { readonly value: T | null | undefined };
  readonly error: { readonly value: unknown };
}

export interface FetchCvDeps<T = Cv> {
  /** `useAsyncData(key, handler)` de Nuxt (la clé et le gestionnaire, rien d'autre). */
  asyncData(key: string, handler: () => Promise<T>): PromiseLike<AsyncDataResult<T>>;
  /** Lit la configuration à la demande : seulement si le gestionnaire s'exécute (au build). */
  settings(): CvSourceSettings;
  readonly fetch: FetchFn;
}

/** Clé de cache et de charge utile d'une langue : une lecture par langue (`cv-fr`, `cv-en`). */
export function cvAsyncDataKey(locale: Locale): string {
  return `cv-${locale}`;
}

/**
 * Lit le CV d'une langue. La source n'est créée que dans le gestionnaire : dans le navigateur, la
 * donnée vient de la charge utile du site statique et la configuration de l'API (privée, absente du
 * client) n'est jamais lue. `useAsyncData` range l'erreur dans `error` sans la lever : on la relève
 * ici, pour que la génération statique échoue au lieu de produire des pages vides.
 *
 * Les sources (schémas Zod des contrats, fixtures) sont importées à la demande, dans le gestionnaire
 * (lot F9a) : le navigateur ne les évalue pas. Zod 4 sonde `new Function` à la construction de ses
 * schémas d'objet (compilation à la volée) ; sous la CSP stricte du site (`script-src` sans
 * `'unsafe-eval'`), cette sonde est une violation sur chaque page. Dans le build client de
 * `nuxt generate`, `select-cv-source.ts` est remplacé par `browser-cv-source.ts` (lot F11, greffon de
 * `nuxt.config.ts`) : la source n'est pas non plus publiée dans les scripts du site.
 */
export async function fetchCv(deps: FetchCvDeps, locale: Locale): Promise<Cv> {
  return read(deps, cvAsyncDataKey(locale), locale, (cv) => cv);
}

/**
 * Lit le CV d'une langue au build et n'en garde que `select(cv)`, rangé sous sa propre clé
 * (`cv-<langue>-<name>`, distincte de celle du CV entier) : la charge utile de la page ne contient que
 * cette valeur (lot 31, page « travaux en cours »). Une erreur levée par `select` fait échouer la
 * génération comme une lecture en échec.
 */
export async function fetchCvValue<T>(
  deps: FetchCvDeps<T>,
  locale: Locale,
  name: string,
  select: (cv: Cv) => T,
): Promise<T> {
  return read(deps, `${cvAsyncDataKey(locale)}-${name}`, locale, select);
}

async function read<T>(
  deps: FetchCvDeps<T>,
  key: string,
  locale: Locale,
  select: (cv: Cv) => T,
): Promise<T> {
  const { data, error } = await deps.asyncData(key, async () => {
    const { createCvSource } = await import('./select-cv-source.js');
    return select(await createCvSource(deps.settings(), deps.fetch).load(locale));
  });
  if (error.value !== null && error.value !== undefined) {
    throw error.value instanceof Error
      ? error.value
      : new Error(`Lecture du CV « ${locale} » impossible`, { cause: error.value });
  }
  if (data.value === null || data.value === undefined) {
    throw new Error(`Lecture du CV « ${locale} » : aucune donnée reçue`);
  }
  return data.value;
}
