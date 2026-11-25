// État de la mosaïque du bureau (lot F6, SPEC § 3.3 à § 4.2) : relie `computeLayout` aux mesures du DOM, sans toucher au DOM lui-même. La mesure est injectée
// (`measure` : hauteur d'un contenu composé à une largeur, sur un clone hors écran dans `TileGrid`).
//
// - Aucun recalcul visible (SPEC § 4.2) : à chaque nouvelle zone ou nouvelle mesure, toutes les hauteurs
//   dont la mise en page peut avoir besoin sont mesurées d'avance, pour la mosaïque ET pour chacune des
//   quatre tuiles agrandies (`prefetch`). Un clic sur
//   « agrandir » trouve alors tout en cache : la géométrie finale est connue dès la première image de
//   l'animation et rien ne bouge après.
// - Le rendu ne mesure jamais : la mise en page lit le cache (`known`), qui ne change qu'avec `version`.
// - `instant` coupe les transitions pendant deux images quand la mise en page change pour une autre raison
//   qu'un agrandissement (premier placement, redimensionnement, polices chargées, texte agrandi) : seuls
//   l'agrandissement et la réduction s'animent.
import { computed, ref, shallowRef, type ComputedRef, type Ref } from 'vue';

import { computeLayout, TILE_ORDER } from '../../domain/layout.js';
import type { ContentHeight, MosaicLayout, TileId, Zone } from '../../domain/layout-types.js';

/**
 * Écart entre le décor réel d'une tuile (44 px de barre + trois traits de 1,5 px = 48,5 px, `Tile.vue`) et
 * `TILE_CHROME.height` (48) de la logique de mise en page : ajouté aux hauteurs mesurées et retiré de la
 * hauteur disponible du Profil, pour qu'un contenu « qui tient » ne laisse pas un demi-pixel à défiler.
 */
export const CHROME_EXTRA = 0.5;

/** Largeur maximale du contenu d'une tuile (SPEC § 4.2 : 820 px, `--content-max`). */
export const CONTENT_MAX_WIDTH = 820;

/** Hauteur (px) du contenu de `tile` composé à `width` px, sans mise à l'échelle. */
export type MeasureContent = (tile: TileId, width: number) => number;

export interface UseMosaic {
  /** Mise en page courante ; `null` tant que la zone n'est pas connue (ou sous 1024 px). */
  layout: ComputedRef<MosaicLayout | null>;
  /** Vrai pendant deux images après un changement qui ne doit pas s'animer. */
  instant: Readonly<Ref<boolean>>;
  /** Nouvelle zone (largeur de la fenêtre, hauteur sous la barre du haut). */
  setZone: (zone: Zone) => void;
  /** Le contenu a changé (polices, réglages, langue) : toutes les mesures sont refaites. */
  remeasure: () => void;
}

/** Tuile agrandie de chaque état possible : la mosaïque, puis chacune des quatre. */
const STATES: readonly (TileId | null)[] = [null, ...TILE_ORDER];

export function useMosaic(
  expanded: Readonly<Ref<TileId | null>>,
  measure: MeasureContent,
): UseMosaic {
  const zone = shallowRef<Zone | null>(null);
  const version = ref(0);
  const instant = ref(true);
  const heights = new Map<string, number>();
  let frame = 0;
  /** Valeurs mesurées au dernier calcul (`prefetch`) ; `null` : à recalculer (nouvelle zone). */
  let signature: string | null = null;

  const known: ContentHeight = (tile, innerWidth) => heights.get(`${tile}@${innerWidth}`);
  const measuring: ContentHeight = (tile, innerWidth) => {
    const key = `${tile}@${innerWidth}`;
    if (!heights.has(key)) {
      const height = measure(tile, Math.min(innerWidth, CONTENT_MAX_WIDTH));
      heights.set(key, Math.ceil(height + CHROME_EXTRA));
    }
    return heights.get(key);
  };

  function mosaicFor(
    current: Zone,
    state: TileId | null,
    contentHeight: ContentHeight,
  ): MosaicLayout | null {
    const layout = computeLayout({
      zone: current,
      expanded: state,
      contentHeight,
    });
    return layout.mode === 'mosaic' ? layout : null;
  }

  /**
   * Mesure d'avance tout ce que les cinq états peuvent demander pour la zone courante ; rend une
   * signature des valeurs obtenues (hauteurs), pour savoir si une nouvelle mesure change quelque
   * chose.
   */
  function prefetch(current: Zone): string {
    const values: (number | undefined)[] = [];
    const recording: ContentHeight = (tile, innerWidth) => {
      const height = measuring(tile, innerWidth);
      values.push(height);
      return height;
    };
    for (const state of STATES) {
      mosaicFor(current, state, recording);
    }
    return values.join(';');
  }

  /** Coupe les transitions jusqu'à ce que la nouvelle géométrie ait été peinte (deux images). */
  function settle(): void {
    instant.value = true;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        instant.value = false;
      });
    });
  }

  /** Mesure pour la zone courante ; ne touche à rien si les valeurs n'ont pas changé. */
  function refresh(): void {
    const current = zone.value;
    if (current === null) return;
    const next = prefetch(current);
    if (next === signature) return;
    signature = next;
    version.value += 1;
    settle();
  }

  function setZone(next: Zone): void {
    const current = zone.value;
    if (current !== null && current.width === next.width && current.height === next.height) return;
    zone.value = next;
    signature = null;
    refresh();
  }

  function remeasure(): void {
    heights.clear();
    refresh();
  }

  const layout = computed(() => {
    void version.value;
    const current = zone.value;
    return current === null ? null : mosaicFor(current, expanded.value, known);
  });

  return { layout, instant, setZone, remeasure };
}
