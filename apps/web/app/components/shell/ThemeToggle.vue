<script setup lang="ts">
// Bascule du thème sombre/clair (F3-02) : un bouton dont le nom annonce le thème actuel et l'action
// (« Thème sombre, passer en thème clair »). Le choix est mémorisé (`usePreferences`).
import { computed } from 'vue';
import { useI18n } from '#imports';

import { usePreferences } from '../../composables/shell/usePreferences.js';

const { t } = useI18n();
const { preferences, toggleTheme } = usePreferences();
const label = computed(() =>
  t(preferences.value.theme === 'sombre' ? 'shell.theme.toLight' : 'shell.theme.toDark'),
);
</script>

<template>
  <button
    type="button"
    class="shell-icon-button shell-press"
    :aria-label="label"
    @click="toggleTheme"
  >
    <svg
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
    </svg>
  </button>
</template>

<style scoped src="./shell.css"></style>
