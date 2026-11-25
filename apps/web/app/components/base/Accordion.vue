<script setup lang="ts">
// Accordéon (ticket F1-03, SPEC § 6) : bouton chevron de 44 × 44 px en haut à droite de l'en-tête,
// `aria-expanded` et `aria-controls`, panneau animé par `grid-template-rows` 0fr → 1fr (`--dur-accordion`,
// 320 ms, 0,01 ms si le mouvement est réduit).
//
// L'état est un `v-model` (booléen, replié par défaut). Les slots suivent la carte d'expérience :
//   header   : titre, organisation, période (à gauche du bouton) ;
//   intro    : contenu toujours visible entre l'en-tête et le panneau (lieu, résumé) ;
//   default  : contenu du panneau, replié = `inert` + `visibility: hidden` après l'animation (hors de
//              l'ordre de tabulation et de l'arbre d'accessibilité) ;
//   footer   : contenu toujours visible sous le panneau (puces de stack).
// `toggleLabel` est le nom accessible du bouton (« Voir le détail de … »), à fournir traduit ; il ne
// change pas avec l'état, `aria-expanded` le porte.

import { useId } from 'vue';

// Nom multi-mot (règle `vue/multi-word-component-names`) : celui que Nuxt donne à l'élément de base.
defineOptions({ name: 'BaseAccordion' });

defineProps<{ toggleLabel: string }>();

const expanded = defineModel<boolean>({ default: false });
const panelId = useId();
</script>

<template>
  <div class="accordion">
    <div class="accordion__head">
      <div class="accordion__header"><slot name="header" /></div>
      <button
        type="button"
        class="accordion__toggle"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="panelId"
        :aria-label="toggleLabel"
        @click="expanded = !expanded"
      >
        <svg
          class="accordion__chevron"
          :class="{ 'accordion__chevron--open': expanded }"
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
    <slot name="intro" />
    <div
      :id="panelId"
      class="accordion__panel"
      :class="{ 'accordion__panel--open': expanded }"
      :inert="!expanded"
    >
      <div class="accordion__content"><slot /></div>
    </div>
    <slot name="footer" />
  </div>
</template>

<style scoped>
.accordion {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.accordion__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.accordion__header {
  flex: 1;
  min-width: 0;
}

/* 44 × 44 px, calé dans le coin (marges négatives de la maquette) pour ne pas agrandir l'en-tête. */
.accordion__toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  margin: -0.625rem -0.5rem -0.625rem 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background-color: transparent;
  color: var(--text);
}

.accordion__chevron {
  transition: transform var(--dur-accordion) var(--ease-ui);
}

.accordion__chevron--open {
  transform: rotate(180deg);
}

/* Replié : 0fr et invisible une fois l'animation finie (le délai laisse la hauteur se refermer) ;
   déplié : visible tout de suite. */
.accordion__panel {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  transition:
    grid-template-rows var(--dur-accordion) var(--ease-ui),
    visibility 0s linear var(--dur-accordion);
}

.accordion__panel--open {
  grid-template-rows: 1fr;
  visibility: visible;
  transition:
    grid-template-rows var(--dur-accordion) var(--ease-ui),
    visibility 0s linear 0s;
}

.accordion__content {
  min-height: 0;
  overflow: hidden;
}
</style>
