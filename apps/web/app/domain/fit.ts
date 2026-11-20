// Facteur de réduction S du Profil (SPEC § 4.1) : le Profil ne défile pas dans la mosaïque, il est
// élargi à `largeur / S` puis mis à l'échelle `scale(S)` depuis son coin haut gauche, ce qui le fait
// occuper toute la colonne avec des lignes recomposées. Module pur : la hauteur du contenu à une
// largeur donnée vient d'une fonction de mesure injectée (clone hors écran dans l'application).

/** S minimal : en dessous, le Profil défile au lieu de rétrécir. */
export const FIT_MIN_SCALE = 0.6;
/** Nombre de pas de la dichotomie ; l'intervalle (0,4) est divisé par 2^10, soit un pas < 0,0004. */
export const FIT_ITERATIONS = 10;
/** Marge de mesure (px) : un contenu qui dépasse de moins que cela est tenu pour contenu. */
export const FIT_TOLERANCE = 0.5;
/** Précision de S : arrondi à l'inférieur au millième, donc jamais au-dessus du S qui tient. */
export const FIT_PRECISION = 1000;
/** Largeur maximale du contenu (SPEC § 4.2 : 820 px), avant élargissement par `1 / S`. */
export const FIT_MAX_CONTENT_WIDTH = 820;

/** Hauteur (px) du contenu une fois composé à la largeur donnée (px), sans mise à l'échelle. */
export type MeasureHeight = (width: number) => number;

export interface FitRequest {
  /** Largeur (px) du contenu à S = 1 : largeur intérieure de la tuile. */
  width: number;
  /** Hauteur (px) disponible pour le contenu à l'écran, mis à l'échelle. */
  availableHeight: number;
  /** Texte agrandi (SPEC § 4.1) : la réduction est désactivée, S vaut 1. */
  textEnlarged: boolean;
}

export interface FitResult {
  /** Facteur S, entre `FIT_MIN_SCALE` et 1. */
  scale: number;
  /**
   * Largeur (px) à donner au contenu avant `scale(S)`, plafonnée à 820 / S : à l'écran, il occupe
   * alors `min(width, 820)`.
   */
  contentWidth: number;
  /** Le contenu dépasse encore la hauteur disponible à ce S : la tuile doit défiler. */
  overflows: boolean;
}

/**
 * Plus grand S (entre `FIT_MIN_SCALE` et 1) pour lequel le contenu élargi à `largeur / S` puis réduit
 * de S tient dans `availableHeight`. S vaut 1 quand le contenu tient déjà, ou quand le texte est
 * agrandi (alors `overflows` dit si le Profil doit défiler). Si même `FIT_MIN_SCALE` ne suffit pas,
 * S vaut `FIT_MIN_SCALE` et `overflows` est vrai. Précision : voir `FIT_ITERATIONS`, `FIT_PRECISION`.
 */
export function computeFit(measure: MeasureHeight, request: FitRequest): FitResult {
  const { width, availableHeight, textEnlarged } = request;
  const limit = availableHeight + FIT_TOLERANCE;
  const baseWidth = Math.min(width, FIT_MAX_CONTENT_WIDTH);
  const heightAt = (scale: number): number => measure(baseWidth / scale) * scale;
  const result = (scale: number, overflows: boolean): FitResult => ({
    scale,
    contentWidth: baseWidth / scale,
    overflows,
  });

  if (heightAt(1) <= limit) return result(1, false);
  if (textEnlarged) return result(1, true);

  let low = FIT_MIN_SCALE;
  let high = 1;
  for (let step = 0; step < FIT_ITERATIONS; step += 1) {
    const middle = (low + high) / 2;
    if (heightAt(middle) <= availableHeight) low = middle;
    else high = middle;
  }
  const scale = Math.floor(low * FIT_PRECISION) / FIT_PRECISION;
  return result(scale, heightAt(scale) > limit);
}

export interface FitCache {
  /** Résultat mis en cache pour (largeur, hauteur disponible arrondie au pixel, texte agrandi). */
  fit(request: FitRequest): FitResult;
  /** À appeler quand le contenu change (langue, polices chargées, texte) : tout est recalculé. */
  invalidate(): void;
}

/** Calcul de S avec un cache par (largeur, hauteur), invalidable. */
export function createFitCache(measure: MeasureHeight): FitCache {
  const cache = new Map<string, FitResult>();
  return {
    fit(request) {
      const key = `${request.width}x${Math.round(request.availableHeight)}:${request.textEnlarged}`;
      const known = cache.get(key);
      if (known !== undefined) return known;
      const computed = computeFit(measure, request);
      cache.set(key, computed);
      return computed;
    },
    invalidate() {
      cache.clear();
    },
  };
}
