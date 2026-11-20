<script setup lang="ts">
// Tuile (ticket F1-05, SPEC § 4) : fenêtre de la mosaïque, barre de titre lilas `>_ fichier`, bouton
// agrandir / réduire, corps. Le placement (position, taille, ordre d'empilement, animation 550 ms) est
// celui de `TileGrid` (F6) : il se pose sur la tuile par `style` / `class` (attributs transmis à la
// racine) avec `--dur-tile` et `--ease-tile`.
//
// - Racine `<section>` nommée par `label` (« Profil », « Expérience »…). Le corps est un groupe nommé
//   par le titre ; quand il peut défiler (`scrollable`, défaut) il est atteignable au clavier
//   (`tabindex="0"`). `scrollable: false` (Profil dans la mosaïque, qui ne défile jamais) rogne sans
//   défilement ni arrêt de tabulation.
// - Bouton agrandir / réduire : `expandLabel` / `collapseLabel` (noms accessibles, déjà traduits,
//   ex. « Agrandir Profil » / « Réduire Profil ») selon `expanded` ; l'événement `toggle` demande le
//   changement d'état, la tuile n'en garde aucun.
// - `pushedOut` (tuile sortie de la zone) : `inert` + `aria-hidden="true"` ; le masquage visuel
//   (`visibility: hidden` différé de 550 ms) est posé par TileGrid.
//
// Hauteur de la barre : 44 px (`--tile-title-bar`) + trait de 1,5 px, comme la maquette (barre en
// `content-box`) ; avec la bordure de la tuile (2 × 1,5 px), 48,5 px de décor au-dessus du contenu :
// c'est le « 48 » de la logique de mise en page (la maquette ajoute 3 px à la hauteur du contenu).

import { useId } from 'vue';

// Nom multi-mot (règle `vue/multi-word-component-names`) : celui que Nuxt donne à l'élément de base.
defineOptions({ name: 'BaseTile' });

withDefaults(
  defineProps<{
    /** Nom de fichier de la barre de titre, sans le `>_` (ex. `profil.cv`). */
    title: string;
    /** Nom accessible de la tuile (région). */
    label: string;
    expanded?: boolean;
    expandLabel: string;
    collapseLabel: string;
    pushedOut?: boolean;
    scrollable?: boolean;
  }>(),
  { expanded: false, pushedOut: false, scrollable: true },
);

const emit = defineEmits<{ toggle: [] }>();

const titleId = useId();
</script>

<template>
  <section
    class="tile"
    :aria-label="label"
    :aria-hidden="pushedOut ? 'true' : undefined"
    :inert="pushedOut"
  >
    <div class="tile__bar">
      <span class="tile__prompt" aria-hidden="true">&gt;_</span>
      <span :id="titleId" class="tile__title">{{ title }}</span>
      <button
        type="button"
        class="tile__toggle"
        :aria-label="expanded ? collapseLabel : expandLabel"
        @click="emit('toggle')"
      >
        <svg
          v-if="expanded"
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 10h-6V4M4 14h6v6M14 10l6-6M10 14l-6 6" />
        </svg>
        <svg
          v-else
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
        </svg>
      </button>
    </div>
    <div
      class="tile__body"
      :class="{ 'tile__body--scroll': scrollable }"
      role="group"
      :aria-labelledby="titleId"
      :tabindex="scrollable ? 0 : undefined"
    >
      <slot />
    </div>
  </section>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: var(--border-strong);
  border-radius: var(--radius-window);
  background-color: var(--card);
  color: var(--text);
  box-shadow: var(--shadow);
}

.tile__bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  height: var(--tile-title-bar);
  box-sizing: content-box;
  padding-inline-start: 1rem;
  border-bottom: var(--border-strong);
  background-color: var(--bar);
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
}

.tile__prompt {
  margin-inline-end: 0.5rem;
  color: var(--accent);
  font-weight: var(--font-weight-bold);
}

.tile__title {
  flex: 1;
  min-width: 0;
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
}

.tile__toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  padding: 0;
  border: 0;
  background-color: transparent;
  color: var(--muted);
}

.tile__toggle:focus-visible {
  /* À l'intérieur du bouton : un contour décalé vers l'extérieur serait rogné par `overflow: hidden`. */
  outline-offset: -4px;
}

.tile__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  scrollbar-color: var(--line) transparent;
  scrollbar-width: thin;
}

.tile__body--scroll {
  overflow-x: hidden;
  overflow-y: auto;
}

.tile__body:focus-visible {
  /* Le corps focalisable est rogné par la tuile : contour intérieur. */
  outline-offset: -4px;
}
</style>
