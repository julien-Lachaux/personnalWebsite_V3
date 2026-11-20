<script setup lang="ts">
// Interrupteur (ticket F1-03, SPEC § 10.1) : `button role="switch" aria-checked`, avec son libellé et
// une description facultative. Le nom accessible est le libellé (`aria-labelledby`), la description
// est reliée par `aria-describedby`. `v-model` booléen ; Entrée et Espace basculent (comportement
// natif du bouton). Rangée de 52 px au moins, piste et pastille décoratives (`aria-hidden`).

import { useId } from 'vue';

// Nom multi-mot (règle `vue/multi-word-component-names`) : celui que Nuxt donne à l'élément de base.
defineOptions({ name: 'BaseSwitch' });

defineProps<{ label: string; description?: string }>();

const checked = defineModel<boolean>({ default: false });
const labelId = useId();
const descriptionId = useId();
</script>

<template>
  <button
    type="button"
    role="switch"
    class="switch"
    :aria-checked="checked ? 'true' : 'false'"
    :aria-labelledby="labelId"
    :aria-describedby="description ? descriptionId : undefined"
    @click="checked = !checked"
  >
    <span class="switch__text">
      <span :id="labelId" class="switch__label">{{ label }}</span>
      <span v-if="description" :id="descriptionId" class="switch__description">{{
        description
      }}</span>
    </span>
    <span class="switch__track" aria-hidden="true"><span class="switch__knob"></span></span>
  </button>
</template>

<style scoped>
.switch {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 3.25rem;
  padding: 0.5rem 0.25rem;
  border: 0;
  border-bottom: var(--border-thin);
  background-color: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  text-align: start;
}

.switch__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.125rem;
}

.switch__label {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
}

.switch__description {
  color: var(--muted);
  font-size: var(--font-size-meta);
  line-height: 1.35;
}

.switch__track {
  position: relative;
  flex-shrink: 0;
  width: 2.625rem;
  height: 1.5rem;
  border: var(--border-width) solid var(--line);
  border-radius: 0.75rem;
  background-color: var(--bg);
  transition:
    background-color var(--dur-press),
    border-color var(--dur-press);
}

.switch__knob {
  position: absolute;
  top: 0.125rem;
  left: 0.125rem;
  width: 1.0625rem;
  height: 1.0625rem;
  border-radius: 50%;
  background-color: var(--muted);
  transition:
    transform var(--dur-press),
    background-color var(--dur-press);
}

.switch[aria-checked='true'] .switch__track {
  border-color: var(--accent);
  background-color: var(--accent);
}

.switch[aria-checked='true'] .switch__knob {
  background-color: var(--on);
  transform: translateX(1.125rem);
}
</style>
