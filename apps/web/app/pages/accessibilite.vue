<script setup lang="ts">
// Déclaration d'accessibilité : page PROVISOIRE (lot F3a) pour que le lien du panneau d'accessibilité
// mène quelque part ; son contenu et sa mise en page viennent avec le lot F7 (F7-01). Fichier partagé,
// réservé au lead-architecte.
const { t } = useI18n();
const localePath = useLocalePath();

useHead(() => ({ title: t('declaration.title') }));
</script>

<template>
  <main id="contenu" class="declaration" tabindex="-1">
    <h1>{{ t('declaration.title') }}</h1>
    <p>{{ t('declaration.pending') }}</p>
    <p>
      <NuxtLink :to="localePath('/')">{{ t('declaration.back') }}</NuxtLink>
    </p>
  </main>
</template>

<style scoped>
.declaration {
  max-width: var(--content-max);
  margin-inline: auto;
  padding: 3rem var(--mobile-gutter);
}

h1 {
  margin-block: 0 1rem;
  font-size: var(--font-size-h1-portable);
  font-weight: var(--font-weight-bold);
  line-height: 1.1;
}
</style>
