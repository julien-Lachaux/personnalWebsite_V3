<script setup lang="ts">
// Champ du filtre (SPEC § 5) : les technos choisies en puces (cliquer une puce la retire), la saisie et,
// quand il y a des filtres, « Effacer ». Le champ est un vrai `input`, nommé par le libellé visible
// « filtrer par techno » (`labelledby`, fourni par `TechFilter`).
// Clavier : Entrée → `submit` (première suggestion valide), Retour arrière sur un champ vide →
// `backspace-empty` (retire la dernière puce). Échap est géré par `TechFilter` (il couvre aussi le panneau).
// Le champ demande l'ouverture du panneau (`open`) au clic et au focus du clavier ou de la souris, jamais
// au focus programmatique : `focusQuietly()` (retour du focus après une action) ne l'ouvre pas.
import { ref } from 'vue';
import { useI18n } from '#imports';

import type { FilterTech } from '../../domain/filter.js';
import BaseButton from '../base/Button.vue';

defineProps<{
  /** Identifiant du libellé visible qui nomme le champ. */
  labelledby: string;
  /** Technos choisies, dans l'ordre du choix. */
  chips: readonly FilterTech[];
  placeholder: string;
  /** Élément que le champ pilote : le panneau, ou les suggestions pendant la saisie. */
  controls: string;
}>();

const emit = defineEmits<{
  open: [];
  submit: [];
  'backspace-empty': [];
  remove: [slug: string];
  clear: [];
}>();

const query = defineModel<string>('query', { default: '' });

const { t } = useI18n();
const input = ref<HTMLInputElement | null>(null);
let quiet = false;

function onFocus(): void {
  if (!quiet) emit('open');
}

function onKeydown(event: KeyboardEvent, chipCount: number): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    emit('submit');
  } else if (event.key === 'Backspace' && query.value === '' && chipCount > 0) {
    emit('backspace-empty');
  }
}

/** Remet le focus dans le champ sans demander l'ouverture du panneau. */
function focusQuietly(): void {
  quiet = true;
  input.value!.focus();
  quiet = false;
}

defineExpose({ focusQuietly });
</script>

<template>
  <div class="chip-input">
    <svg
      class="chip-input__icon"
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
    <button
      v-for="chip in chips"
      :key="chip.slug"
      type="button"
      class="chip-input__chip"
      :aria-label="t('experience.filter.removeChip', { name: chip.name })"
      @click="emit('remove', chip.slug)"
    >
      {{ chip.name }}
      <svg
        aria-hidden="true"
        focusable="false"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
    <input
      ref="input"
      v-model="query"
      type="text"
      class="chip-input__field"
      :placeholder="placeholder"
      :aria-labelledby="labelledby"
      :aria-controls="controls"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="search"
      @focus="onFocus"
      @click="emit('open')"
      @keydown="onKeydown($event, chips.length)"
    />
    <BaseButton
      v-if="chips.length > 0"
      variant="link"
      tone="muted"
      :aria-label="t('experience.filter.clearAll')"
      @click="emit('clear')"
    >
      {{ t('experience.filter.clear') }}
    </BaseButton>
  </div>
</template>

<style scoped>
.chip-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  min-height: 3.125rem;
  box-sizing: border-box;
  padding: 0.375rem 0.375rem 0.375rem 0.75rem;
  border: var(--border-control);
  border-radius: var(--radius-button);
  background-color: var(--field);
}

.chip-input__icon {
  flex-shrink: 0;
  color: var(--muted);
}

/* Puce choisie : néon, comme les puces actives de l'élément de base (hauteur de la maquette, D17). */
.chip-input__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2.25rem;
  padding: 0 0.625rem;
  border: var(--border-width) solid var(--neon);
  border-radius: var(--radius-chip);
  background-color: var(--neon-bg);
  color: var(--neon);
  font-family: var(--font-sans);
  font-size: var(--font-size-body-mobile);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
}

.chip-input__field {
  flex: 1;
  min-width: 9.375rem;
  height: 2.25rem;
  border: 0;
  /* Le contour de focus est porté par le cadre du champ (`.chip-input:has(…:focus-visible)`). */
  background-color: transparent;
  color: var(--text);
  font: inherit;
  font-size: var(--font-size-body-mobile);
}

/* Le champ n'a pas de contour propre : c'est le cadre qui porte l'anneau de focus (2 px accent, décalé de
   2 px, comme base.css), pour ne pas dessiner un rectangle dans un rectangle. */
.chip-input__field:focus-visible {
  outline: none;
}

.chip-input:has(.chip-input__field:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.chip-input__field::placeholder {
  color: var(--muted);
  opacity: 1;
}

@media (max-width: 1023px) {
  .chip-input__field {
    min-height: var(--touch-target);
  }
}
</style>
