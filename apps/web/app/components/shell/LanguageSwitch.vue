<script setup lang="ts">
// Sélecteur de langue FR/EN (F3-02) : un lien vers la même page dans l'autre langue
// (`useSwitchLocalePath`), qui affiche le code de la langue cible. `lang` et `hreflang` disent la
// langue de la cible ; le nom accessible est le nom de cette langue dans cette langue
// (« English », « Français »).
import { computed } from 'vue';
import { useI18n, useSwitchLocalePath } from '#imports';

const { locale, t } = useI18n();
const switchLocalePath = useSwitchLocalePath();

const target = computed<'fr' | 'en'>(() => (locale.value === 'fr' ? 'en' : 'fr'));
</script>

<template>
  <NuxtLink
    :to="switchLocalePath(target)"
    :lang="target"
    :hreflang="target"
    class="shell-icon-button shell-press"
  >
    <span aria-hidden="true">{{ target.toUpperCase() }}</span>
    <span class="visually-hidden">{{ t(`shell.language.${target}`) }}</span>
  </NuxtLink>
</template>

<style scoped src="./shell.css"></style>
