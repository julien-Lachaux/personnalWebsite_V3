<script setup lang="ts">
// Racine de l'application : `lang` de <html>, liens hreflang et canonical de la langue courante
// (docs/05, F0-05). Fichier partagé, réservé au lead-architecte.
const head = useLocaleHead();

useHead(() => ({
  htmlAttrs: { lang: head.value.htmlAttrs.lang },
  link: [...head.value.link],
  meta: [...head.value.meta],
}));
</script>

<template>
  <NuxtPage />
</template>
