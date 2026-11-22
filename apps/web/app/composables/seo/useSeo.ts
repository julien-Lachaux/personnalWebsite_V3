// Méta de référencement (lot F7, F7-03). Deux niveaux :
// - `useSiteSeo`, appelé une fois par app.vue : description par défaut de la langue (`seo.description`),
//   Open Graph minimal (type, titre = titre de la page par le paramètre `%s` d'unhead, description).
//   `og:url`, `og:locale` et `og:locale:alternate` viennent de `useLocaleHead` (app.vue), avec
//   `lang`, `hreflang` et `canonical`. Pas d'`og:image` tant que Julien n'en fournit pas.
// - `usePageSeo`, appelé par une page : son titre et sa description (et `og:description`), qui
//   remplacent ceux par défaut.
// Les pages d'erreur n'appellent ni l'un ni l'autre : `error.vue` pose `noindex`, sans canonique.
import { useI18n, useSeoMeta } from '#imports';

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
