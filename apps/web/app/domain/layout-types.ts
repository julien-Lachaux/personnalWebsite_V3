// Types de la mise en page des tuiles (`layout.ts`). Types seuls : aucun code exécutable.

/** Les quatre sections, dans l'ordre de la colonne latérale (SPEC § 4.2). */
export type TileId = 'profile' | 'experience' | 'recommendations' | 'ai';

/** Rectangle en pixels, dans le repère de la zone des tuiles (origine en haut à gauche). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Zone disponible : la largeur de la fenêtre et la hauteur sous la barre du haut. */
export interface Zone {
  width: number;
  height: number;
}

/**
 * Hauteur (px) du contenu d'une tuile, hors barre de titre et bordures, composé à la largeur
 * intérieure donnée ; `undefined` tant que la mesure n'est pas faite (la tuile prend alors toute la
 * hauteur et l'empilement est écarté).
 */
export type ContentHeight = (tile: TileId, innerWidth: number) => number | undefined;

export interface LayoutInput {
  zone: Zone;
  /** Tuile agrandie, ou `null` pour la mosaïque (ignoré hors mosaïque). */
  expanded: TileId | null;
  /** Texte agrandi (SPEC § 4.1) : le Profil ne se réduit pas et défile. */
  textEnlarged: boolean;
  contentHeight: ContentHeight;
}

/**
 * - `mosaic` : place de la mosaïque ;
 * - `expanded` : tuile agrandie ;
 * - `stacked` : Profil ou IA posé sous l'autre, à la même largeur ;
 * - `side` : colonne latérale à droite de la tuile agrandie ;
 * - `pushed` : sortie de la zone (invisible, non focalisable).
 */
export type Placement = 'mosaic' | 'expanded' | 'stacked' | 'side' | 'pushed';

/** Côté de la zone par lequel une tuile est poussée. */
export type PushDirection = 'left' | 'right' | 'top' | 'bottom';

export interface TileLayout {
  id: TileId;
  rect: Rect;
  /** Faux pour une tuile poussée hors zone : `visibility: hidden` après l'animation, `inert`. */
  visible: boolean;
  placement: Placement;
  /** Côté de sortie d'une tuile `pushed`, sinon `null`. */
  push: PushDirection | null;
}

/**
 * - `reduced` : le Profil tient sans défiler grâce au facteur S (`fit.ts`) ;
 * - `scrolling` : S = 1 et le Profil défile (colonne latérale, texte agrandi).
 */
export type ProfileMode = 'reduced' | 'scrolling';

/** Ce que `fit.ts` doit connaître du Profil pour calculer S. */
export interface ProfileFit {
  mode: ProfileMode;
  /** Largeur intérieure (px) de la tuile du Profil : `FitRequest.width`. */
  contentWidth: number;
  /** Hauteur intérieure (px) de la tuile du Profil : `FitRequest.availableHeight`. */
  availableHeight: number;
}

/** Une section à la fois (mobile) ou une colonne centrée (tablette). */
export interface TabsLayout {
  mode: 'tabs';
  device: 'mobile' | 'tablet';
  /** Colonne du contenu : toute la largeur (mobile) ou 640 px centrés (tablette). */
  column: { x: number; width: number };
}

export interface MosaicLayout {
  mode: 'mosaic';
  /** 2 colonnes de 1024 à 1199 px, 3 colonnes à partir de 1200 px. */
  columns: 2 | 3;
  /** Zone des tuiles, plafonnée à 1440 px et centrée ; marges et gouttières comprises. */
  area: Rect;
  expanded: TileId | null;
  tiles: Record<TileId, TileLayout>;
  profile: ProfileFit;
}

export type Layout = TabsLayout | MosaicLayout;
