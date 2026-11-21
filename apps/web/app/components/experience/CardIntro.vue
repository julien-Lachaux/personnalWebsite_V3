<script setup lang="ts">
// Texte toujours visible d'une carte d'expérience (SPEC § 6) : lieu · mode · contrat (masqué si vide),
// correspondance partielle « En partie : X » (cartes repliées derrière « Voir les N autres ») et résumé.
import type { ExperienceView } from '../../data/cv-view.js';

defineProps<{
  experience: ExperienceView;
  /** « En partie : X » ; absent hors des cartes atténuées. */
  partial?: string | undefined;
}>();
</script>

<template>
  <div class="card-intro">
    <p v-if="experience.meta" class="card-intro__meta">{{ experience.meta }}</p>
    <p v-if="partial" class="card-intro__partial">{{ partial }}</p>
    <p v-if="experience.summary" class="card-intro__summary">{{ experience.summary }}</p>
  </div>
</template>

<style scoped>
.card-intro {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.card-intro p {
  margin: 0;
}

.card-intro__meta {
  color: var(--muted);
  font-size: var(--font-size-small);
}

.card-intro__partial {
  color: var(--accent);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
}

.card-intro__summary {
  font-size: var(--font-size-body-mobile);
  line-height: 1.5;
}
</style>
