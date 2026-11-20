<script setup lang="ts">
// Sélecteur de langue FR/EN (F3-02, décision D19) : un lien vers la même page dans l'autre langue
// (`useSwitchLocalePath`). Il affiche le code de la langue COURANTE (« FR » sur la page française, comme
// la maquette) ; son nom accessible annonce l'action (« Passer en anglais », « Switch to French »), dans
// la langue de la page. `hreflang` et `lang` du lien disent la langue de la cible ; le nom, écrit dans
// la langue de la page, porte son propre `lang` pour être prononcé correctement.
import { computed } from 'vue';
import { useI18n, useSwitchLocalePath } from '#imports';

const { locale, t } = useI18n();
const switchLocalePath = useSwitchLocalePath();

const current = computed<'fr' | 'en'>(() => (locale.value === 'fr' ? 'fr' : 'en'));
const target = computed<'fr' | 'en'>(() => (current.value === 'fr' ? 'en' : 'fr'));
</script>

<template>
  <NuxtLink
    :to="switchLocalePath(target)"
    :lang="target"
    :hreflang="target"
    class="shell-icon-button shell-press"
  >
    <span aria-hidden="true">{{ current.toUpperCase() }}</span>
    <span class="visually-hidden" :lang="current">{{
      t(`shell.language.switchTo.${target}`)
    }}</span>
  </NuxtLink>
</template>

<style scoped src="./shell.css"></style>
