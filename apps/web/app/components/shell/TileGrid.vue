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
// - Profil (D41) : taille de texte normale, jamais réduit ; il défile comme IA et Recos quand son contenu
//   dépasse la tuile.
// - XP : la tuile ne défile pas, la liste de la section défile seule (hauteur définie par la tuile).
// - Tuile agrandie (D42) : les tuiles de la colonne latérale autres qu'XP (ou que le Profil quand XP est
//   agrandie) se replient en bas sur leur
//   barre de titre (`folded` : corps inerte, non lu, hors de la tabulation) ; XP prend la hauteur libérée.
// - Animation : position et taille ensemble (`--dur-tile`, `--ease-tile`) ; une tuile sortie devient
//   `visibility: hidden` après `--dur-tile`, `inert` et `aria-hidden` tout de suite (`pushedOut`). Pas de
//   transition au premier placement ni quand la zone ou les mesures changent (`instant`).
// - Bouton de chaque tuile : demande `toggle` ; la tuile agrandie est celle de la coquille (`expanded`).
// - Avant le premier placement (page générée, D49) : la coquille rend déjà la mosaïque ; sa CSS (grille,
//   requêtes média) pose les tuiles aux places de la vue d'ensemble que `computeLayout` leur donnera
//   (mêmes constantes en px : `GAP`, `PAGE_MAX_WIDTH`, `PROFILE_WIDTH`, `RIGHT_COLUMN_WIDTH`,
//   `PORTABLE_EXPERIENCE_SHARE`, seuils ; accord vérifié par `TileGrid-premount.spec.ts`, qui évalue
//   ces règles et les compare à `computeLayout`, et dans le navigateur par `test/hydration-shift.e2e.ts`).
//   Le montage passe aux positions absolues calculées (`--placed`) sans déplacer de tuile. Sans
//   JavaScript, chaque tuile défile seule. Sous 1024 px (avant que la coquille ne choisisse les onglets),
//   seul le contenu du Profil est montré, sans décor de tuile, comme l'onglet Profil.
import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue';
import { useI18n } from '#imports';

import { SECTION_FILES } from '../../composables/shell/sections.js';
import { useMosaic } from '../../composables/shell/useMosaic.js';
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

const { layout, instant, setZone, remeasure } = useMosaic(
  computed(() => props.expanded),
  measure,
);

function setContent(id: TileId, element: unknown): void {
  if (element instanceof HTMLElement) contents[id] = element;
}

/**
 * Position calculée d'une tuile, en attribut `style` ; aucun attribut avant le premier placement (la page
 * générée n'a pas de `style=""`, que la CSP stricte refuserait comme style en ligne).
 */
function placement(id: TileId): { style?: CSSProperties } {
  const tile = layout.value?.tiles[id];
  if (tile === undefined) return {};
  const { x, y, width, height } = tile.rect;
  return { style: { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` } };
}

/** XP ne défile jamais (sa liste défile seule) ; Profil, IA et Recos défilent. */
function scrollable(id: TileId): boolean {
  return id !== 'experience';
}

function isFolded(id: TileId): boolean {
  return layout.value?.tiles[id].placement === 'folded';
}

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
  <div
    ref="root"
    class="tile-grid"
    :class="{ 'tile-grid--instant': instant, 'tile-grid--placed': layout !== null }"
  >
    <BaseTile
      v-for="id in TILE_ORDER"
      :key="id"
      class="tile-grid__tile"
      :class="{
        'tile-grid__tile--expanded': expanded === id,
        'tile-grid__tile--out': isOut(id),
      }"
      v-bind="placement(id)"
      :data-tile="id"
      :title="SECTION_FILES[id]"
      :label="t(`shell.headings.${id}`)"
      :expanded="expanded === id"
      :expand-label="t('common.expand', { name: t(`shell.headings.${id}`) })"
      :collapse-label="t('common.collapse', { name: t(`shell.headings.${id}`) })"
      :pushed-out="isOut(id)"
      :folded="isFolded(id)"
      :scrollable="scrollable(id)"
      @toggle="emit('toggle', id)"
    >
      <div
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

/* Avant le premier placement (D49), bureau : la vue d'ensemble de `computeLayout` en grille. Zone de
   1440 px au plus, centrée (décalage arrondi au pixel), marges et gouttières de 12 px (`GAP`) ; en px et
   non en rem : la mise en page calcule en px, quelle que soit la taille du texte. `round()` reproduit
   les arrondis de `computeLayout` ; la grille sans `round()` qui la précède est le repli d'un
   navigateur qui ne le connaît pas (écart d'un demi-pixel au plus). */
@media (min-width: 1024px) {
  .tile-grid:not(.tile-grid--placed) {
    display: grid;
    box-sizing: border-box;
    gap: 12px;
    padding: 12px;
  }

  .tile-grid:not(.tile-grid--placed) .tile-grid__tile {
    position: relative;
    min-width: 0;
    min-height: 0;
  }
}

/* 2 colonnes (1024 à 1199 px) : Profil de 360 px sur toute la hauteur ; XP en haut sur 56 % de la hauteur
   (gouttière déduite), IA et Recos dessous, à parts égales. */
@media (min-width: 1024px) and (max-width: 1199px) {
  .tile-grid:not(.tile-grid--placed) {
    grid-template-rows: 56fr 44fr;
    grid-template-rows: round((100% - 12px) * 0.56, 1px) 1fr;
    grid-template-columns: 360px 1fr 1fr;
    grid-template-columns: 360px round((100% - 384px) / 2, 1px) 1fr;
  }

  .tile-grid:not(.tile-grid--placed) [data-tile='profile'] {
    grid-area: 1 / 1 / 3 / 2;
  }

  .tile-grid:not(.tile-grid--placed) [data-tile='experience'] {
    grid-area: 1 / 2 / 2 / 4;
  }

  .tile-grid:not(.tile-grid--placed) [data-tile='ai'] {
    grid-area: 2 / 2 / 3 / 3;
  }

  .tile-grid:not(.tile-grid--placed) [data-tile='recommendations'] {
    grid-area: 2 / 3 / 3 / 4;
  }
}

/* 3 colonnes (≥ 1200 px) : Profil de 420 px à la hauteur de son contenu (toute la hauteur au plus), XP
   au milieu, colonne de droite de 380 px (IA puis Recos, à parts égales). */
@media (min-width: 1200px) {
  .tile-grid:not(.tile-grid--placed) {
    grid-template-rows: 1fr 1fr;
    grid-template-rows: round((100% - 12px) / 2, 1px) 1fr;
    grid-template-columns: 420px 1fr 380px;
    padding-inline: max(12px, (100% - 1440px) / 2 + 12px);
    padding-inline: calc(max(0px, round((100% - 1440px) / 2, 1px)) + 12px)
      calc(max(0px, 100% - 1440px - round((100% - 1440px) / 2, 1px)) + 12px);
  }

  .tile-grid:not(.tile-grid--placed) [data-tile='profile'] {
    grid-area: 1 / 1 / 3 / 2;
    align-self: start;
    max-height: 100%;
  }

  /* Hauteur du contenu (le corps d'une tuile prend sinon la place restante, `flex: 1`, et rognerait
     1,5 px) ; il rétrécit et défile quand le Profil atteint toute la hauteur. Seul écart avec le
     placement monté : `computeLayout` arrondit la hauteur mesurée au pixel supérieur et compte 48 px
     de décor ; le bas du Profil descend donc de moins de 3 px au montage (rien ne bouge dedans). */
  .tile-grid:not(.tile-grid--placed) [data-tile='profile'] :deep(.tile__body) {
    flex: 0 1 auto;
  }

  .tile-grid:not(.tile-grid--placed) [data-tile='experience'] {
    grid-area: 1 / 2 / 3 / 3;
  }

  .tile-grid:not(.tile-grid--placed) [data-tile='ai'] {
    grid-area: 1 / 3 / 2 / 4;
  }

  .tile-grid:not(.tile-grid--placed) [data-tile='recommendations'] {
    grid-area: 2 / 3 / 3 / 4;
  }
}

/* Avant le montage, sous 1024 px (la coquille n'a pas encore choisi les onglets) : les quatre sections
   l'une sous l'autre (Profil en haut, à la place de l'onglet Profil), sans décor ni défilement propre,
   dans le flux de <main>. */
@media (max-width: 1023px) {
  .tile-grid {
    position: static;
    overflow: visible;
  }

  .tile-grid .tile-grid__tile {
    position: static;
    display: block;
    overflow: visible;
    border: 0;
    border-radius: 0;
    background: none;
    box-shadow: none;
  }

  /* Les trois autres sections suivent le Profil dans le flux : sans JavaScript, la navigation du bas
     ne fonctionne pas et tout le contenu doit rester lisible. Le montage les retire. */
  .tile-grid .tile-grid__tile:not([data-tile='profile']) {
    margin-top: var(--tile-padding);
  }

  .tile-grid__tile :deep(.tile__bar),
  .tile-grid__fade {
    display: none;
  }

  .tile-grid__tile :deep(.tile__body) {
    overflow: visible;
  }

  .tile-grid .tile-grid__content {
    max-width: none;
    padding: 0;
  }
}

/* Premier placement, nouvelle zone, nouvelles mesures : pas d'animation. */
.tile-grid--instant .tile-grid__tile {
  transition: none;
}

.tile-grid__content {
  box-sizing: border-box;
  max-width: var(--content-max);
  margin-inline: auto;
  padding: 1.25rem var(--tile-padding) 0;
}

.tile-grid__content--profile {
  padding: 1.5rem var(--tile-padding) 0.75rem;
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
