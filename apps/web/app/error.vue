<script setup lang="ts">
// Page d'erreur (lot F7, F7-01) : Nuxt la rend À LA PLACE d'app.vue pour toute erreur, d'où les mêmes
// devoirs de racine ici : `lang` de <html>, lien d'évitement en premier élément focalisable, préférences
// branchées (`usePreferencesSync`). Elle s'affiche dans le gabarit des pages annexes (en-tête du site,
// accessibilité, langue, thème) et dans la langue de l'adresse.
//
// - 404 (adresse inconnue) : « Page introuvable ». Prérendue en `/404.html` (fr, par Nuxt,
//   `experimental.prerenderErrorPages`) et `/en/404.html` (domain/error-pages.ts) ; le proxy les sert
//   avec le statut 404 (docs/comptes-rendus/lot-F7-lead.md).
// - Tout autre statut : « Une erreur est survenue », avec le code (500 quand l'erreur n'en porte pas) ;
//   aucun message ni détail technique de l'erreur n'est affiché.
// - Page d'erreur serveur (lot 30) : erreur 404 de son adresse de prérendu, `/50x.html` ou `/en/50x.html`
//   (domain/server-error-page.ts), que le proxy sert pour une réponse 500, 502, 503 ou 504. Message
//   générique sans code (une même page pour quatre statuts), lien « Réessayer » vers l'adresse courante
//   (`href=""` : celle que le proxy a servie), retour à l'accueil. Servie sans JavaScript (nuxt.config.ts
//   retire l'application) : le gabarit n'y porte pas les contrôles de l'en-tête.
// - `noindex` et ni canonique ni hreflang : une page d'erreur n'est pas une page du site (et n'entre
//   pas dans le plan du site, domain/sitemap.ts).
// Fichier partagé, réservé au lead-architecte.
import { computed } from 'vue';
import type { NuxtError } from '#app';

import AnnexPage from './components/annex/AnnexPage.vue';
import { usePreferencesSync } from './composables/shell/usePreferencesSync.js';
import { isServerErrorPage } from './domain/server-error-page.js';

const props = defineProps<{ error: NuxtError }>();

const { t } = useI18n();
const head = useLocaleHead();

usePreferencesSync();

// Adresse que le routeur n'a pas trouvée : son erreur 404 la porte (`data.path`, routeur de Nuxt). Au
// prérendu de `/50x.html`, c'est elle qui désigne la page d'erreur serveur.
const serverError = computed(() =>
  isServerErrorPage(String((props.error.data as { path?: unknown } | null | undefined)?.path)),
);
const notFound = computed(() => !serverError.value && props.error.status === 404);
/** Espace de libellés de la page : `serverError`, `notFound` ou `error`. */
const labels = computed(() => {
  if (serverError.value) return 'serverError';
  return notFound.value ? 'notFound' : 'error';
});
/** Nom de fichier de la fenêtre (ne se traduit pas). */
const file = computed(() => {
  if (serverError.value) return 'erreur-50x.log';
  return notFound.value ? 'erreur-404.log' : 'erreur.log';
});
const status = computed(() => props.error.status ?? 500);

useHead(() => ({
  htmlAttrs: { lang: head.value.htmlAttrs.lang },
  title: t(`${labels.value}.title`),
  meta: [{ name: 'robots', content: 'noindex' }],
}));
</script>

<template>
  <a class="skip-link" href="#contenu">{{ t('common.skipToContent') }}</a>
  <NuxtLayout name="annex" :controls="!serverError">
    <AnnexPage :file="file" :back="t(`${labels}.back`)">
      <h1>{{ t(`${labels}.title`) }}</h1>
      <p>{{ t(`${labels}.text`) }}</p>
      <p v-if="serverError">
        <a href="" class="error-page__retry">{{ t('serverError.retry') }}</a>
      </p>
      <p v-else-if="!notFound" class="error-page__status">{{ t('error.status', { status }) }}</p>
    </AnnexPage>
  </NuxtLayout>
</template>

<style scoped>
/* Action principale de la page d'erreur serveur : cible tactile pleine (D17), lien souligné. */
.error-page__retry {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-target);
  font-family: var(--font-mono);
  font-weight: var(--font-weight-bold);
}

.error-page__status {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
}
</style>
