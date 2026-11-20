<script setup lang="ts">
// Icône d'une section (barre de navigation du bas) : décorative, le libellé de l'onglet donne le nom.
import type { SectionId } from '../../composables/shell/sections.js';

defineProps<{ id: SectionId }>();
</script>

<template>
  <svg
    aria-hidden="true"
    focusable="false"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <template v-if="id === 'profile'">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </template>
    <template v-else-if="id === 'experience'">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </template>
    <path
      v-else-if="id === 'recommendations'"
      d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
    />
    <template v-else>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M10 10h4v4h-4zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </template>
  </svg>
</template>
