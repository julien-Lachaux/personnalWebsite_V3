// Lecture du CV d'une langue pour une page (docs/04, F4-04) : le seul fichier qui relie `app/data/`
// (testé sans Nuxt) à `useAsyncData` et à la configuration privée de Nuxt. La source n'est créée que
// dans le gestionnaire : au build (prérendu), elle lit l'API ou les fixtures selon `NUXT_CV_SOURCE` ;
// dans le navigateur, la donnée vient de la charge utile de la page et la configuration privée n'est
// jamais lue. Une lecture en échec lève (la génération échoue, `nitro.prerender.failOnError`).
// Fichier partagé, réservé au lead-architecte.
import type { Cv, Locale } from '@siteperso/contracts';
import { useAsyncData, useRuntimeConfig } from '#imports';

import { fetchCv, fetchCvValue, type FetchCvDeps } from '../data/fetch-cv.js';
import { linkedinUrl } from '../data/map-cv.js';

/**
 * Erreur de lecture, relevée telle quelle pour la génération. `useAsyncData` range l'erreur en
 * `NuxtError` : le rendu la traite comme une erreur HTTP « gérée » et le prérendu n'affiche qu'un
 * « [500] Server Error », sans la cause. Une `Error` simple au même message (cause conservée) est
 * journalisée par le prérendu (« API injoignable (GET …) : … »).
 */
export class CvReadError extends Error {
  override readonly name = 'CvReadError';
}

/** Dépendances de `data/fetch-cv.ts` fournies par Nuxt (lues pendant le `setup`). */
function nuxtDeps<T>(): FetchCvDeps<T> {
  // Lue pendant le `setup` (contexte de Nuxt) ; ses clés privées ne sont lues que par le gestionnaire.
  const config = useRuntimeConfig();
  return {
    asyncData: (key, handler) => useAsyncData(key, handler),
    settings: () => ({ source: config.cvSource, apiBaseUrl: config.apiBaseUrl }),
    fetch: globalThis.fetch,
  };
}

/** Relève une erreur de lecture en `CvReadError` (même message, cause conservée). */
async function readOrThrow<T>(read: Promise<T>): Promise<T> {
  try {
    return await read;
  } catch (error) {
    // `fetch-cv.ts` ne lève que des `Error`.
    throw new CvReadError((error as Error).message, { cause: error });
  }
}

export async function useCv(locale: Locale): Promise<Cv> {
  return readOrThrow(fetchCv(nuxtDeps<Cv>(), locale));
}

/**
 * URL du profil LinkedIn (lien social `linkedin`) lue au build, seule donnée du CV dans la charge utile
 * de la page qui l'appelle (clé `cv-<langue>-linkedin`, page « travaux en cours », lot 31) ; absente du
 * CV, la génération échoue.
 */
export async function useLinkedinUrl(locale: Locale): Promise<string> {
  return readOrThrow(fetchCvValue(nuxtDeps<string>(), locale, 'linkedin', linkedinUrl));
}
