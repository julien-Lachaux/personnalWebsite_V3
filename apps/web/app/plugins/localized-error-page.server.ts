// Pages 404 des autres langues que la langue par défaut (`/en/404.html`, domain/error-pages.ts) : au
// rendu, l'adresse de la page (`payload.path`) est retirée de la charge utile, comme Nuxt le fait pour
// sa propre `/404.html`. Sans cela, servie par le proxy à une adresse inconnue (`/en/inconnue`), la page
// hydratée remplacerait l'adresse affichée par `/en/404.html` (routeur de Nuxt, vérifié au lot F7).
// Greffon serveur seulement : rien n'est chargé dans le navigateur.
import { defineNuxtPlugin } from '#imports';

import { isLocalizedErrorPage } from '../domain/error-pages.js';

/** Ce que le greffon lit et modifie du contexte de rendu. */
export interface RenderedPage {
  readonly url: string;
  readonly payload: { path?: string };
}

/**
 * Retire l'adresse de rendu de la charge utile d'une page 404 d'une autre langue. Sans contexte de
 * rendu (type de `app:rendered`, qui le déclare facultatif), rien à faire.
 */
export function forgetErrorPagePath(page: RenderedPage | undefined): void {
  if (page !== undefined && isLocalizedErrorPage(page.url)) delete page.payload.path;
}

export default defineNuxtPlugin({
  name: 'localized-error-page',
  setup(nuxtApp) {
    nuxtApp.hooks.hook('app:rendered', ({ ssrContext }) => forgetErrorPagePath(ssrContext));
  },
});
