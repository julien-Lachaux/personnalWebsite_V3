<script setup lang="ts">
// Mosaïque des tuiles du bureau (lot F6, COMPOSANTS « TileGrid », SPEC § 3.3 à § 4.2) : les quatre
// sections dans des `BaseTile` (`profil.cv`, `experience.log`, `recommandations.md`, `ia.md`), placées
// en absolu dans la zone sous la barre du haut selon `computeLayout` (`useMosaic`). Composant partagé de
// la coquille, réservé au lead-architecte ; `AppShell` le rend à partir de 1024 px.
//
// - Zone : la taille de la racine, posée sur tout son parent positionné (le `<main>` de la coquille :
//   toute la largeur, la hauteur restante sous la barre du haut quelle que soit la hauteur réelle de
//   celle-ci), suivie par `ResizeObserver`. Les tuiles poussées sortent de la zone entière (rognée par
//   `overflow: hidden`).
// - Hauteurs naturelles : mesurées sur un clone hors écran du contenu de la tuile (identifiants retirés),
//   posé dans la racine pour hériter des mêmes styles. Nouvelle mesure quand un contenu change de hauteur
//   à largeur égale (`ResizeObserver` ; un changement de largeur vient de la mise en page elle-même et
//   s'anime, il ne relance rien), quand un réglage d'affichage change sur `<html>` (taille du texte,
//   police, espacement) et une fois les polices chargées (`document.fonts.ready`).
// - Profil (SPEC § 4.1) : réduit par S sans défilement dans la mosaïque (largeur `largeur / S` puis
//   `scale(S)` depuis le coin haut gauche) ; défilant en colonne latérale, quand le texte est agrandi ou
//   quand même S = 0,6 ne suffit pas.
// - XP : la tuile ne défile pas, la liste de la section défile seule (hauteur définie par la tuile).
// - Animation : position, taille et S ensemble (`--dur-tile`, `--ease-tile`) ; une tuile sortie devient
//   `visibility: hidden` après `--dur-tile`, `inert` et `aria-hidden` tout de suite (`pushedOut`). Pas de
//   transition au premier placement ni quand la zone ou les mesures changent (`instant`).
// - Bouton de chaque tuile : demande `toggle` ; la tuile agrandie est celle de la coquille (`expanded`).
import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue';
import { useI18n } from '#imports';

import { SECTION_FILES } from '../../composables/shell/sections.js';
import { useMosaic } from '../../composables/shell/useMosaic.js';
import { usePreferences } from '../../composables/shell/usePreferences.js';
import { TILE_ORDER } from '../../domain/layout.js';
import type { TileId } from '../../domain/layout-types.js';
import BaseTile from '../base/Tile.vue';

const props = defineProps<{
  /** Tuile agrandie ; `null` : mosaïque. */
  expanded: TileId | null;
}>();

const emit = defineEmits<{ toggle: [id: TileId] }>();

defineSlots<{
  profile(props: Record<string, never>): unknown;
  experience(props: Record<string, never>): unknown;
  recommendations(props: Record<string, never>): unknown;
  ai(props: Record<string, never>): unknown;
}>();

/** Tuiles dont la hauteur de contenu compte dans la mise en page (XP prend toujours sa place). */
const MEASURED: readonly TileId[] = ['profile', 'recommendations', 'ai'];
/** Réglages de `<html>` qui changent la composition du texte. */
const TEXT_ATTRIBUTES = ['data-text-size', 'data-font', 'data-spacing'];

const { t } = useI18n();
const { preferences } = usePreferences();

const root = ref<HTMLElement | null>(null);
const contents: Partial<Record<TileId, HTMLElement>> = {};

/** Hauteur du contenu de `tile` composé à `width` px, mesurée sur un clone hors écran. */
function measure(tile: TileId, width: number): number {
  const clone = contents[tile]!.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  for (const element of clone.querySelectorAll('[id]')) element.removeAttribute('id');
  Object.assign(clone.style, {
    position: 'absolute',
    top: '0',
    left: '-99999px',
    visibility: 'hidden',
    width: `${width}px`,
    maxWidth: 'none',
    height: 'auto',
    margin: '0',
    transform: 'none',
    transition: 'none',
  });
  root.value!.append(clone);
  const height = clone.getBoundingClientRect().height;
  clone.remove();
  return height;
}

const { layout, fit, instant, setZone, remeasure } = useMosaic(
  computed(() => props.expanded),
  computed(() => preferences.value.textSize !== 100),
  measure,
);

function setContent(id: TileId, element: unknown): void {
  if (element instanceof HTMLElement) contents[id] = element;
}

function tileStyle(id: TileId): CSSProperties | undefined {
  const tile = layout.value?.tiles[id];
  if (tile === undefined) return undefined;
  const { x, y, width, height } = tile.rect;
  return { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` };
}

/**
 * XP ne défile jamais (sa liste défile seule) ; le Profil seulement hors réduction (colonne latérale,
 * texte agrandi) ou si S = 0,6 ne suffit pas ; IA et Recos toujours.
 */
function scrollable(id: TileId): boolean {
  if (id === 'experience') return false;
  return id !== 'profile' || fit.value === null || fit.value.overflows;
}

/** Contenu du Profil élargi puis réduit (S < 1) ; rien à poser quand il défile. */
const profileStyle = computed<CSSProperties | undefined>(() => {
  if (fit.value === null) return undefined;
  return { width: `${fit.value.contentWidth}px`, transform: `scale(${fit.value.scale})` };
});

function isOut(id: TileId): boolean {
  return layout.value?.tiles[id].visible === false;
}

let observer: ResizeObserver | null = null;
let attributes: MutationObserver | null = null;
let alive = true;

onMounted(() => {
  const element = root.value!;
  const zone = (): void => setZone({ width: element.clientWidth, height: element.clientHeight });
  const seen = new WeakMap<Element, { width: number; height: number }>();

  zone();
  observer = new ResizeObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      if (entry.target === element) {
        zone();
        continue;
      }
      const { width, height } = entry.contentRect;
      const last = seen.get(entry.target);
      seen.set(entry.target, { width, height });
      if (last?.width === width && last.height !== height) changed = true;
    }
    if (changed) remeasure();
  });
  observer.observe(element);
  for (const id of MEASURED) observer.observe(contents[id]!);
  attributes = new MutationObserver(remeasure);
  attributes.observe(document.documentElement, {
    attributes: true,
    attributeFilter: TEXT_ATTRIBUTES,
  });
  void document.fonts.ready.then(() => {
    if (alive) remeasure();
  });
});

onBeforeUnmount(() => {
  alive = false;
  observer!.disconnect();
  attributes!.disconnect();
});
</script>

<template>
  <div ref="root" class="tile-grid" :class="{ 'tile-grid--instant': instant }">
    <BaseTile
      v-for="id in TILE_ORDER"
      :key="id"
      class="tile-grid__tile"
      :class="{
        'tile-grid__tile--expanded': expanded === id,
        'tile-grid__tile--out': isOut(id),
      }"
      :style="tileStyle(id)"
      :data-tile="id"
      :title="SECTION_FILES[id]"
      :label="t(`shell.headings.${id}`)"
      :expanded="expanded === id"
      :expand-label="t('common.expand', { name: t(`shell.headings.${id}`) })"
      :collapse-label="t('common.collapse', { name: t(`shell.headings.${id}`) })"
      :pushed-out="isOut(id)"
      :scrollable="scrollable(id)"
      @toggle="emit('toggle', id)"
    >
      <div v-if="id === 'profile'" class="tile-grid__fit">
        <div
          :ref="(element) => setContent(id, element)"
          class="tile-grid__content tile-grid__content--profile"
          :style="profileStyle"
        >
          <slot name="profile" />
        </div>
      </div>
      <div
        v-else
        :ref="(element) => setContent(id, element)"
        class="tile-grid__content"
        :class="`tile-grid__content--${id}`"
      >
        <slot :name="id" />
        <div v-if="id !== 'experience'" class="tile-grid__fade" aria-hidden="true"></div>
      </div>
    </BaseTile>
  </div>
</template>

<style scoped>
/* Toute la place du parent (positionné), sans dépendre d'une hauteur en pourcentage. */
.tile-grid {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.tile-grid .tile-grid__tile {
  position: absolute;
  box-sizing: border-box;
  z-index: 1;
  visibility: visible;
  transition:
    left var(--dur-tile) var(--ease-tile),
    top var(--dur-tile) var(--ease-tile),
    width var(--dur-tile) var(--ease-tile),
    height var(--dur-tile) var(--ease-tile),
    visibility 0s linear 0s;
}

.tile-grid .tile-grid__tile--expanded {
  z-index: 2;
  border-color: var(--accent);
}

/* Sortie de la zone : invisible une fois l'animation finie (SPEC § 4.2). */
.tile-grid .tile-grid__tile--out {
  visibility: hidden;
  transition-delay: 0s, 0s, 0s, 0s, var(--dur-tile);
}

/* Premier placement, nouvelle zone, nouvelles mesures : pas d'animation. */
.tile-grid--instant .tile-grid__tile,
.tile-grid--instant .tile-grid__content--profile {
  transition: none;
}

/* Profil : boîte de la largeur visible (contenu de 820 px au plus, centré), contenu élargi puis réduit
   depuis son coin haut gauche. */
.tile-grid__fit {
  width: min(100%, var(--content-max));
  margin-inline: auto;
}

.tile-grid__content {
  box-sizing: border-box;
  max-width: var(--content-max);
  margin-inline: auto;
  padding: 1.25rem var(--tile-padding) 0;
}

.tile-grid__content--profile {
  max-width: none;
  padding: 1.5rem var(--tile-padding) 0.75rem;
  transform-origin: top left;
  transition:
    transform var(--dur-tile) var(--ease-tile),
    width var(--dur-tile) var(--ease-tile);
}

/* XP : toute la hauteur de la tuile, la section gère ses marges et sa liste qui défile. */
.tile-grid__content--experience {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: none;
  padding: 0;
}

/* Fondu du bas des tuiles qui défilent : le texte ne se coupe pas net sur le bord ; en fin de défilement,
   il est sous le contenu et ne recouvre rien. */
.tile-grid__fade {
  position: sticky;
  bottom: 0;
  height: 1.5rem;
  margin-top: 0.375rem;
  background: linear-gradient(to bottom, transparent, var(--card));
  pointer-events: none;
}
</style>
