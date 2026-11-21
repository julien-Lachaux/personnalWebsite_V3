<script setup lang="ts">
// Puces de stack d'une carte d'expérience (SPEC § 5 et § 6) : chaque puce active ou désactive le filtre
// (`aria-pressed`, néon au survol et quand elle est active) ; la puce « Huile de coude » de la pause
// professionnelle n'est pas un filtre : elle ouvre l'easter egg (`easter-egg`, avec la puce comme
// élément où rendre le focus).
import { useI18n } from '#imports';

import type { ExperienceView } from '../../data/cv-view.js';
import BaseTechChip from '../base/TechChip.vue';

defineProps<{
  experience: ExperienceView;
  /** Slugs des technos choisies. */
  selected: readonly string[];
}>();
const emit = defineEmits<{ toggle: [slug: string]; 'easter-egg': [trigger: HTMLElement] }>();

const { t } = useI18n();
</script>

<template>
  <ul v-if="experience.stack.length > 0" class="card-stack">
    <li v-for="chip in experience.stack" :key="chip.slug ?? 'easter-egg'">
      <BaseTechChip
        v-if="chip.easterEgg"
        @click="emit('easter-egg', $event.currentTarget as HTMLElement)"
      >
        {{ chip.label }}
      </BaseTechChip>
      <BaseTechChip
        v-else
        :pressed="selected.includes(chip.slug!)"
        :aria-label="t('experience.card.filterBy', { name: chip.label })"
        @click="emit('toggle', chip.slug!)"
      >
        {{ chip.label }}
      </BaseTechChip>
    </li>
  </ul>
</template>

<style scoped>
.card-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0;
  padding: 0.125rem 0 0;
  list-style: none;
}
</style>
