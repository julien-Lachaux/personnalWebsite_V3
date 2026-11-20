<script setup lang="ts">
// Une techno du panneau du filtre (stack principale, « Toutes les technos ») : puce de l'élément de base
// `TechChip` (taille du filtre) selon l'état rendu par `domain/filter.techCounter` :
// - `available` / `selected` : bouton `aria-pressed`, compteur dynamique ; un clic bascule le filtre ;
// - `disabled` (0 résultat si on l'ajoute) : atténuée, `aria-disabled`, garde le focus, clic sans effet ;
// - `unlinked` (aucune expérience détaillée) : pointillé, non cliquable (`<span>`), la raison est
//   ajoutée pour les lecteurs d'écran.
// Le compteur est écrit ici, après une espace, et non par la prop `count` de la puce : le texte visible
// (« NestJS 1 ») doit se retrouver tel quel dans le nom accessible (axe, WCAG 2.5.3), sans soudure
// « NestJS1 ». Le nom accessible commence par le texte visible, compteur compris (« TypeScript, 2 expériences »,
// « Node.js, 0 expérience avec les filtres en cours ») : WCAG 2.5.3, commande vocale.
import { computed } from 'vue';
import { useI18n } from '#imports';

import type { FilterTech, TechCounter } from '../../domain/filter.js';
import BaseTechChip from '../base/TechChip.vue';

const props = defineProps<{ tech: FilterTech; counter: TechCounter }>();
const emit = defineEmits<{ toggle: [slug: string] }>();

const { t } = useI18n();

const label = computed(() =>
  props.counter.state === 'disabled'
    ? t('experience.tech.disabled', { name: props.tech.name, n: props.counter.count })
    : t(
        'experience.tech.available',
        { name: props.tech.name, n: props.counter.count },
        props.counter.count,
      ),
);
</script>

<template>
  <BaseTechChip v-if="counter.state === 'unlinked'" dashed size="md">
    {{ tech.name }}
    <span class="visually-hidden">({{ t('experience.drawer.unlinkedHint') }})</span>
  </BaseTechChip>
  <BaseTechChip
    v-else
    size="md"
    :pressed="counter.state === 'selected'"
    :disabled="counter.state === 'disabled'"
    :aria-label="label"
    @click="emit('toggle', tech.slug)"
  >
    {{ tech.name }}
    <span class="tech-option__count">{{ counter.count }}</span>
  </BaseTechChip>
</template>

<style scoped>
/* Même apparence que le compteur de `TechChip` (`count`). */
.tech-option__count {
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
  opacity: 0.75;
}
</style>
