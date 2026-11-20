<script setup lang="ts">
// En-tête d'une carte d'expérience (SPEC § 6) : intitulé du poste, organisation (accent, préfixée `@` ou
// `›`, symbole décoratif caché des lecteurs d'écran), période (mono, violet). Posé dans l'en-tête de
// l'accordéon ou, sans détail, directement dans la carte.
import type { ExperienceView } from '../../data/cv-view.js';

defineProps<{
  experience: ExperienceView;
  /** Identifiant du titre, qui nomme la carte (`aria-labelledby`). */
  titleId: string;
}>();
</script>

<template>
  <div class="card-header">
    <h3 :id="titleId" class="card-header__title">{{ experience.title }}</h3>
    <p v-if="experience.organisation" class="card-header__org">
      <span aria-hidden="true">{{ experience.prefix }}</span> {{ experience.organisation }}
    </p>
    <p class="card-header__period">{{ experience.period }}</p>
  </div>
</template>

<style scoped>
.card-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.card-header p {
  margin: 0;
}

.card-header__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.card-header__org {
  color: var(--accent);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
}

.card-header__period {
  color: var(--violet);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}
</style>
