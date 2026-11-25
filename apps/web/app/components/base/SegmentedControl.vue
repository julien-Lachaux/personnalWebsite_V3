<script setup lang="ts" generic="T extends string">
// Contrôle segmenté (ticket F1-03, SPEC § 10.1) : groupe de boutons `aria-pressed` pour un choix
// exclusif (taille du texte : 100, 115, 130 %). Le groupe porte un nom (`label`, à fournir traduit) ;
// un nom visible ailleurs se relie avec un `aria-labelledby` en attribut, qui prime. Chaque option a
// un `label` visible et, si le visible ne suffit pas (la lettre « A »), un `ariaLabel`. Le slot
// `option` (porte `option` et `pressed`) remplace le contenu d'un bouton (taille de la lettre).
// `v-model` : la valeur de l'option choisie. Boutons de 44 px au moins.
export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  ariaLabel?: string;
}

defineProps<{ options: readonly SegmentedOption<T>[]; label?: string }>();

const selected = defineModel<T>({ required: true });
</script>

<template>
  <div role="group" class="segmented" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="segmented__option"
      :aria-pressed="option.value === selected ? 'true' : 'false'"
      :aria-label="option.ariaLabel"
      @click="selected = option.value"
    >
      <slot name="option" :option="option" :pressed="option.value === selected">{{
        option.label
      }}</slot>
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  gap: 0.5rem;
}

.segmented__option {
  flex: 1;
  min-height: var(--touch-target);
  border: var(--border-control);
  border-radius: var(--radius-control);
  background-color: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  transition:
    background-color var(--dur-press),
    border-color var(--dur-press),
    color var(--dur-press);
}

.segmented__option[aria-pressed='true'] {
  border-color: var(--accent);
  background-color: var(--accent);
  color: var(--on);
}
</style>
