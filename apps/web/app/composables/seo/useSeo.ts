// Méta de référencement (lot F7, F7-03). Deux niveaux :
// - `useSiteSeo`, appelé une fois par app.vue : description par défaut de la langue (`seo.description`),
//   Open Graph minimal (type, titre = titre de la page par le paramètre `%s` d'unhead, description).
//   `og:url`, `og:locale` et `og:locale:alternate` viennent de `useLocaleHead` (app.vue), avec
//   `lang`, `hreflang` et `canonical`. Pas d'`og:image` tant que Julien n'en fournit pas.
// - `usePageSeo`, appelé par une page : son titre et sa description (et `og:description`), qui
//   remplacent ceux par défaut.
// - `useUnindexedPage`, appelé par une page hors index (page « travaux en cours », lot 31) : `noindex`,
//   et app.vue, qui lit `useIndexedPage`, ne pose alors ni canonique, ni hreflang, ni `og:url`, ni
//   `og:locale` : la page n'entre pas dans le plan du site (domain/sitemap.ts).
// Les pages d'erreur n'appellent ni l'un ni l'autre : `error.vue` pose `noindex`, sans canonique.
import { computed, type ComputedRef } from 'vue';
import { useI18n, useRoute, useSeoMeta, useState } from '#imports';

/**
 * État partagé (transmis du prérendu au navigateur) : chemin de la dernière page qui s'est déclarée
 * hors index. Comparé au chemin courant, il ne vaut que pour cette page : après une navigation vers
 * une autre page, celle-ci redevient indexée sans remise à zéro.
 */
export const UNINDEXED_PATH_STATE_KEY = 'seo-unindexed-path';

/** Titre et description d'une page, déjà traduits. */
export interface PageSeo {
  readonly title: string;
  readonly description: string;
}

/** Méta par défaut de toutes les pages de la langue courante (app.vue). */
export function useSiteSeo(): void {
  const { t } = useI18n();
  useSeoMeta({
    description: () => t('seo.description'),
    ogType: 'website',
    ogTitle: '%s',
    ogDescription: () => t('seo.description'),
  });
}

/** Titre et description propres à une page (`source` relu à chaque changement de langue). */
export function usePageSeo(source: () => PageSeo): void {
  useSeoMeta({
    title: () => source().title,
    description: () => source().description,
    ogDescription: () => source().description,
  });
}

/** Vrai sauf sur une page qui s'est déclarée hors index (`useUnindexedPage`) ; lu par app.vue. */
export function useIndexedPage(): ComputedRef<boolean> {
  const route = useRoute();
  const unindexed = useState<string | null>(UNINDEXED_PATH_STATE_KEY, () => null);
  return computed(() => unindexed.value !== route.path);
}

/** Déclare la page courante hors index : `noindex`, et ni canonique ni hreflang (app.vue). */
export function useUnindexedPage(): void {
  const route = useRoute();
  useState<string | null>(UNINDEXED_PATH_STATE_KEY, () => null).value = route.path;
  useSeoMeta({ robots: 'noindex' });
}
