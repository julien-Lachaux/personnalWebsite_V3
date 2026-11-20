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
