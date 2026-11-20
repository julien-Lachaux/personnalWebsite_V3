<script setup lang="ts">
// Page d'accueil provisoire (lot F0) : remplacée par la coquille et les sections (F3, F5).
const { t, locale } = useI18n();
const switchLocalePath = useSwitchLocalePath();

const otherLocale = computed(() => (locale.value === 'fr' ? 'en' : 'fr'));

useHead(() => ({ title: t('home.title') }));
</script>

<template>
  <main>
    <h1>{{ t('home.heading') }}</h1>
    <p>{{ t('home.intro') }}</p>
    <p>
      <NuxtLink :to="switchLocalePath(otherLocale)" :lang="otherLocale" :hreflang="otherLocale">
        {{ t('home.otherLanguage') }}
      </NuxtLink>
    </p>
  </main>
</template>

<style scoped>
/* Mise en page provisoire : fond, police, couleurs et focus viennent des styles globaux (F1). */
main {
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

p {
  font-size: var(--font-size-lead-mobile);
}
</style>
