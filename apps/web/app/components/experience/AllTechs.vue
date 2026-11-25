<script setup lang="ts">
// « Toutes les technos » du panneau du filtre (SPEC § 5) : toutes les technos par domaine, chacune avec
// son compteur dynamique (`TechOption`) ; en pointillé, celles sans expérience détaillée.
import { useId } from 'vue';
import { useI18n } from '#imports';

import type { TechGroupView } from '../../data/cv-view.js';
import type { TechCounter } from '../../domain/filter.js';
import TechOption from './TechOption.vue';

defineProps<{
  groups: readonly TechGroupView[];
  /** Compteur d'une techno (état et nombre d'expériences), par slug. */
  counterOf: (slug: string) => TechCounter;
}>();
const emit = defineEmits<{ toggle: [slug: string] }>();

const { t } = useI18n();
const prefix = useId();
</script>

<template>
  <div class="all-techs">
    <p class="all-techs__intro">{{ t('experience.drawer.intro') }}</p>
    <div
      v-for="group in groups"
      :key="group.slug"
      class="all-techs__group"
      role="group"
      :aria-labelledby="`${prefix}-${group.slug}`"
    >
      <p :id="`${prefix}-${group.slug}`" class="all-techs__title">{{ group.name }}</p>
      <div class="all-techs__items">
        <TechOption
          v-for="tech in group.techs"
          :key="tech.slug"
          :tech="tech"
          :counter="counterOf(tech.slug)"
          @toggle="emit('toggle', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.all-techs {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  margin: 0 0 1rem;
  padding: 0.875rem;
  border: var(--border-control);
  border-radius: 10px;
  background-color: var(--card);
}

.all-techs__intro {
  margin: 0;
  color: var(--muted);
  font-size: var(--font-size-small);
  line-height: 1.45;
}

.all-techs__group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.all-techs__title {
  margin: 0;
  color: var(--violet);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
}

.all-techs__items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
</style>
