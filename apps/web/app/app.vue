<script setup lang="ts">
// Racine de l'application : `lang` de <html>, liens hreflang et canonical de la langue courante
// (docs/05, F0-05) ; préférences branchées sur le navigateur, une seule fois pour toute l'application
// (`usePreferencesSync`, lot F3b : système, stockage, attributs de <html>) ; lien d'évitement « Aller au
// contenu », premier élément focalisable de chaque page, vers `#contenu` (le <main> de la coquille).
// Méta de référencement par défaut de la langue (`useSiteSeo`, lot F7) ; gabarit de la page
// (`<NuxtLayout>` : aucun pour l'accueil, `annex` pour les pages annexes, lot F7). Une page hors index
// (`useUnindexedPage`, lot 31) n'a ni canonique, ni hreflang, ni `og:url`, ni `og:locale`. Le script de thème
// sans flash (D5) est posé en tête par nuxt.config.ts. En cas d'erreur, Nuxt rend error.vue à la place
// de ce fichier. Fichier partagé, réservé au lead-architecte.
import { useIndexedPage, useSiteSeo } from './composables/seo/useSeo.js';
import { usePreferencesSync } from './composables/shell/usePreferencesSync.js';

const head = useLocaleHead();
const { t } = useI18n();
const indexed = useIndexedPage();

usePreferencesSync();
useSiteSeo();

useHead(() => ({
  htmlAttrs: { lang: head.value.htmlAttrs.lang },
  link: indexed.value ? [...head.value.link] : [],
  meta: indexed.value ? [...head.value.meta] : [],
}));
</script>

<template>
  <a class="skip-link" href="#contenu">{{ t('common.skipToContent') }}</a>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
