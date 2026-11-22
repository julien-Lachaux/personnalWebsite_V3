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
// - `noindex` et ni canonique ni hreflang : une page d'erreur n'est pas une page du site (et n'entre
//   pas dans le plan du site, domain/sitemap.ts).
// Fichier partagé, réservé au lead-architecte.
import { computed } from 'vue';
import type { NuxtError } from '#app';

import AnnexPage from './components/annex/AnnexPage.vue';
import { usePreferencesSync } from './composables/shell/usePreferencesSync.js';

const props = defineProps<{ error: NuxtError }>();

const { t } = useI18n();
const head = useLocaleHead();

usePreferencesSync();

const notFound = computed(() => props.error.status === 404);
/** Espace de libellés de la page : `notFound` ou `error`. */
const labels = computed(() => (notFound.value ? 'notFound' : 'error'));
const status = computed(() => props.error.status ?? 500);

useHead(() => ({
  htmlAttrs: { lang: head.value.htmlAttrs.lang },
  title: t(`${labels.value}.title`),
  meta: [{ name: 'robots', content: 'noindex' }],
}));
</script>

<template>
  <a class="skip-link" href="#contenu">{{ t('common.skipToContent') }}</a>
  <NuxtLayout name="annex">
    <AnnexPage :file="notFound ? 'erreur-404.log' : 'erreur.log'" :back="t(`${labels}.back`)">
      <h1>{{ t(`${labels}.title`) }}</h1>
      <p>{{ t(`${labels}.text`) }}</p>
      <p v-if="!notFound" class="error-page__status">{{ t('error.status', { status }) }}</p>
    </AnnexPage>
  </NuxtLayout>
</template>

<style scoped>
.error-page__status {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
}
</style>
