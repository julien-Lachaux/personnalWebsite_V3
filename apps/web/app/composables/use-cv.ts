// Lecture du CV d'une langue pour une page (docs/04, F4-04) : le seul fichier qui relie `app/data/`
// (testé sans Nuxt) à `useAsyncData` et à la configuration privée de Nuxt. La source n'est créée que
// dans le gestionnaire : au build (prérendu), elle lit l'API ou les fixtures selon `NUXT_CV_SOURCE` ;
// dans le navigateur, la donnée vient de la charge utile de la page et la configuration privée n'est
// jamais lue. Une lecture en échec lève (la génération échoue, `nitro.prerender.failOnError`).
// Fichier partagé, réservé au lead-architecte.
import type { Cv, Locale } from '@siteperso/contracts';
import { useAsyncData, useRuntimeConfig } from '#imports';

import { fetchCv } from '../data/fetch-cv.js';

export function useCv(locale: Locale): Promise<Cv> {
  // Lue pendant le `setup` (contexte de Nuxt) ; ses clés privées ne sont lues que par le gestionnaire.
  const config = useRuntimeConfig();
  return fetchCv(
    {
      asyncData: (key, handler) => useAsyncData(key, handler),
      settings: () => ({ source: config.cvSource, apiBaseUrl: config.apiBaseUrl }),
      fetch: globalThis.fetch,
    },
    locale,
  );
}
