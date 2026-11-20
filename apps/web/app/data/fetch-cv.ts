// Lecture du CV pour une page (docs/04, F4-04) : le pont entre la source et `useAsyncData` de Nuxt,
// sans importer Nuxt. Les dépendances sont injectées ; `app/composables/use-cv.ts` (fichier partagé)
// les fournit avec `useAsyncData`, `useRuntimeConfig` et le `fetch` de Node (voir le compte rendu
// du lot F4).
import { type Cv, type Locale } from '@siteperso/contracts';

import { type FetchFn } from './cv-source.js';
import { createCvSource, type CvSourceSettings } from './select-cv-source.js';

/** Ce que `useAsyncData` de Nuxt rend une fois attendu, réduit à ce dont on se sert. */
export interface AsyncDataResult {
  readonly data: { readonly value: Cv | null | undefined };
  readonly error: { readonly value: unknown };
}

export interface FetchCvDeps {
  /** `useAsyncData(key, handler)` de Nuxt (la clé et le gestionnaire, rien d'autre). */
  asyncData(key: string, handler: () => Promise<Cv>): PromiseLike<AsyncDataResult>;
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
 */
export async function fetchCv(deps: FetchCvDeps, locale: Locale): Promise<Cv> {
  const { data, error } = await deps.asyncData(cvAsyncDataKey(locale), () =>
    createCvSource(deps.settings(), deps.fetch).load(locale),
  );
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
