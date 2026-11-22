// Pages d'erreur statiques du site généré (lot F7, F7-01). Module pur, lu par nuxt.config.ts et par le
// greffon `plugins/localized-error-page.server.ts`.
//
// Nuxt écrit `/404.html` rendue côté serveur (`experimental.prerenderErrorPages`) : c'est la page de la
// langue par défaut (fr, sans préfixe). Celle des autres langues (`/en/404.html`) est une route de plus
// à prérendre : le routeur n'y trouve aucune page et rend `error.vue` dans la langue du préfixe ; le
// prérendu la garde malgré son statut 404 (nuxt.config.ts) et son adresse de rendu est retirée de la
// charge utile (greffon), comme Nuxt le fait pour `/404.html`. Le proxy (Caddy) sert chacune avec le
// statut 404 pour toute adresse inconnue de sa langue (docs/comptes-rendus/lot-F7-lead.md).

/** Pages 404 des autres langues, à prérendre en plus. */
export const LOCALIZED_ERROR_PAGES: readonly string[] = ['/en/404.html'];

/** Vrai pour une page 404 d'une autre langue que la langue par défaut. */
export function isLocalizedErrorPage(path: string): boolean {
  return LOCALIZED_ERROR_PAGES.includes(path);
}
