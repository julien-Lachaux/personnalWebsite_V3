<script setup lang="ts">
// Suggestions de saisie (SPEC § 5) : 6 technos au plus avec le nombre d'expériences, à la place du panneau
// tant que le champ n'est pas vide. Chaque suggestion est un vrai bouton ; l'état vient de
// `domain/filter.suggest` :
// - `available` : ajoute la techno ;
// - `disabled` (0 résultat avec les filtres en cours) : atténuée, `aria-disabled`, clic sans effet ;
// - `unlinked` (aucune expérience détaillée) : atténuée, `aria-disabled`, « sans XP détaillée ».
// Sans suggestion : message et lien « Voir toutes les technos ».
// Le nom accessible de chaque bouton reprend le texte visible (nom, puis « N XP » ou « sans XP
// détaillée ») : WCAG 2.5.3, commande vocale.
import { useI18n } from '#imports';

import type { Suggestion } from '../../domain/filter.js';
import BaseButton from '../base/Button.vue';

defineProps<{
  id: string;
  suggestions: readonly Suggestion[];
  /** Saisie en cours (reprise dans le message « aucune techno ne correspond »). */
  query: string;
}>();
const emit = defineEmits<{ pick: [slug: string]; 'show-all': [] }>();

const { t } = useI18n();

function label(suggestion: Suggestion): string {
  const { name } = suggestion.tech;
  const n = suggestion.count;
  if (suggestion.state === 'unlinked') return t('experience.suggestions.unlinked', { name });
  if (suggestion.state === 'disabled') return t('experience.suggestions.disabled', { name, n });
  return t('experience.suggestions.add', { name, n });
}

function pick(suggestion: Suggestion): void {
  if (suggestion.selectable) emit('pick', suggestion.tech.slug);
}
</script>

<template>
  <div :id="id" class="suggestions" role="group" :aria-label="t('experience.suggestions.label')">
    <button
      v-for="suggestion in suggestions"
      :key="suggestion.tech.slug"
      type="button"
      class="suggestions__item"
      :class="{ 'suggestions__item--dim': !suggestion.selectable }"
      :aria-label="label(suggestion)"
      :aria-disabled="suggestion.selectable ? undefined : 'true'"
      @click="pick(suggestion)"
    >
      <span class="suggestions__name">{{ suggestion.tech.name }}</span>
      {{ ' ' }}
      <span class="suggestions__count">
        {{
          suggestion.state === 'unlinked'
            ? t('experience.suggestions.noXp')
            : t('experience.suggestions.count', { n: suggestion.count })
        }}
      </span>
    </button>
    <p v-if="suggestions.length === 0" class="suggestions__none">
      {{ t('experience.suggestions.none', { query: query.trim() }) }}
      <BaseButton variant="link" @click="emit('show-all')">
        {{ t('experience.suggestions.showAll') }}
      </BaseButton>
    </p>
  </div>
</template>

<style scoped>
.suggestions {
  overflow: hidden;
  border: var(--border-control);
  border-radius: var(--radius-button);
  background-color: var(--card);
  box-shadow: var(--shadow);
}

.suggestions__item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  min-height: 3rem;
  padding: 0 0.875rem;
  border: 0;
  border-bottom: var(--border-thin);
  background-color: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--font-size-body-mobile);
  text-align: start;
  cursor: pointer;
}

.suggestions__item--dim {
  opacity: 0.55;
  cursor: not-allowed;
}

.suggestions__name {
  flex: 1;
}

.suggestions__count {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
}

.suggestions__none {
  margin: 0;
  padding: 0.875rem;
  color: var(--muted);
  font-size: var(--font-size-lead);
  line-height: 1.45;
}

@media (min-width: 1024px) {
  .suggestions__none {
    font-size: var(--font-size-body-mobile);
  }
}
</style>
