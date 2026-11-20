<script setup lang="ts">
// Racine de l'application : `lang` de <html>, liens hreflang et canonical de la langue courante
// (docs/05, F0-05) ; préférences branchées sur le navigateur, une seule fois pour toute l'application
// (`usePreferencesSync`, lot F3b : système, stockage, attributs de <html>) ; lien d'évitement « Aller au
// contenu », premier élément focalisable de chaque page, vers `#contenu` (le <main> de la coquille).
// Le script de thème sans flash (D5) est posé en tête par nuxt.config.ts. Fichier partagé, réservé au
// lead-architecte.
import { usePreferencesSync } from './composables/shell/usePreferencesSync.js';

const head = useLocaleHead();
const { t } = useI18n();

usePreferencesSync();

useHead(() => ({
  htmlAttrs: { lang: head.value.htmlAttrs.lang },
  link: [...head.value.link],
  meta: [...head.value.meta],
}));
</script>

<template>
  <a class="skip-link" href="#contenu">{{ t('common.skipToContent') }}</a>
  <NuxtPage />
</template>
