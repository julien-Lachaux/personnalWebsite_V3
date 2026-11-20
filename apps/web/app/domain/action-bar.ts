// Comportement de défilement de la coquille mobile et tablette (SPEC § 3.1) : masquage de la barre
// d'actions et présence de la flèche « faire défiler ». Module pur : il ne connaît ni le DOM ni
// l'horloge ; le composable fournit la position de défilement et l'heure.

/** Distance de défilement (px) au-delà de laquelle la barre se masque ou revient. */
export const ACTION_BAR_THRESHOLD = 24;
/** Verrou (ms) après chaque bascule, pour éviter l'oscillation en bas de page. */
export const ACTION_BAR_LOCK_MS = 360;
/** Marge (px) sous laquelle le contenu restant n'est pas considéré comme caché. */
export const SCROLL_HINT_TOLERANCE = 2;

export interface ActionBarState {
  /** La barre est masquée. */
  hidden: boolean;
  /** Position de défilement de référence : le dernier sommet ou fond du mouvement en cours. */
  anchor: number;
  /** Instant (ms) avant lequel toute bascule est refusée. */
  lockUntil: number;
}

/** État au changement d'onglet (ou au premier rendu) : barre visible, référence au défilement courant. */
export function initialActionBarState(scrollTop: number): ActionBarState {
  return { hidden: false, anchor: scrollTop, lockUntil: 0 };
}

/**
 * État suivant à une nouvelle position de défilement `scrollTop` (px) à l'instant `now` (ms).
 *
 * - Pendant le verrou, seule la référence suit le défilement.
 * - Barre visible : un défilement vers le bas de plus de 24 px depuis la référence, au-delà des
 *   24 premiers pixels de la page, la masque ; un défilement vers le haut ramène la référence.
 * - Barre masquée : un défilement vers le haut de plus de 24 px depuis la référence, ou le retour dans
 *   les 24 premiers pixels de la page, la ramène ; un défilement vers le bas ramène la référence.
 * Chaque bascule pose le verrou et prend la position courante pour référence. Quand rien ne change,
 * la fonction rend l'état reçu lui-même.
 */
export function nextActionBarState(
  state: ActionBarState,
  scrollTop: number,
  now: number,
): ActionBarState {
  if (now < state.lockUntil) return { ...state, anchor: scrollTop };
  const toggled: ActionBarState = {
    hidden: !state.hidden,
    anchor: scrollTop,
    lockUntil: now + ACTION_BAR_LOCK_MS,
  };
  if (state.hidden) {
    if (scrollTop > state.anchor) return { ...state, anchor: scrollTop };
    const scrolledUp = state.anchor - scrollTop > ACTION_BAR_THRESHOLD;
    return scrolledUp || scrollTop < ACTION_BAR_THRESHOLD ? toggled : state;
  }
  if (scrollTop < state.anchor) return { ...state, anchor: scrollTop };
  const scrolledDown = scrollTop - state.anchor > ACTION_BAR_THRESHOLD;
  return scrolledDown && scrollTop > ACTION_BAR_THRESHOLD ? toggled : state;
}

/** Mesures d'une zone qui défile (`scrollHeight`, `scrollTop`, `clientHeight`). */
export interface ScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

/** Vrai quand du contenu reste caché sous le bord bas de la zone (flèche « faire défiler »). */
export function hasHiddenContent(metrics: ScrollMetrics): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight > SCROLL_HINT_TOLERANCE;
}
