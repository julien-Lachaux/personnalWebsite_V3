// Mise en page des tuiles (SPEC § 3 et § 4, COMPOSANTS « layoutService ») : fonction pure qui
// transforme la taille de la zone, la tuile agrandie et les hauteurs naturelles mesurées en
// rectangles et en visibilité. Elle ne connaît ni le DOM ni Vue : les mesures arrivent par
// `contentHeight`, le résultat se lit en pixels, l'animation reste en CSS.
//
// Référence de la géométrie : `renderVals()` des maquettes desktop (3 colonnes) et portable
// (2 colonnes) ; en cas d'écart, la SPEC gagne. Les tailles sont arrondies au pixel : les parts
// égales ou proportionnelles se répartissent sans trou ni recouvrement.
import type {
  Layout,
  LayoutInput,
  MosaicLayout,
  PushDirection,
  Rect,
  TabsLayout,
  TileId,
  TileLayout,
  Zone,
} from './layout-types.js';

/** Ordre de lecture des tuiles ; la colonne latérale le suit (SPEC § 4.2). */
export const TILE_ORDER: readonly TileId[] = ['profile', 'experience', 'recommendations', 'ai'];

/** Marges de la zone et gouttières entre tuiles (px). */
export const GAP = 12;
/** Largeur maximale de la zone des tuiles, centrée au-delà (SPEC § 3.5). */
export const PAGE_MAX_WIDTH = 1440;
/** Largeur de la tuile agrandie : 820 px de contenu + 2 × 24 px de marge (SPEC § 4.2). */
export const EXPANDED_MAX_WIDTH = 868;
/** Place minimale à droite de la tuile agrandie pour la colonne latérale (SPEC § 4.2). */
export const SIDE_MIN_WIDTH = 340;
/** Colonne du contenu en tablette (SPEC § 3.2). */
export const TABLET_COLUMN_WIDTH = 640;
/** Seuils de largeur (px) : tablette, mosaïque 2 colonnes, mosaïque 3 colonnes (SPEC § 3). */
export const BREAKPOINTS = { tablet: 768, portable: 1024, desktop: 1200 } as const;
/** Bordures (largeur) et barre de titre avec bordures (hauteur) autour du contenu d'une tuile. */
export const TILE_CHROME = { width: 3, height: 48 } as const;
/** Hauteur d'une tuile repliée sur sa barre de titre : décor réel de 48,5 px, arrondi au pixel (D42). */
export const FOLDED_HEIGHT = 49;

/** Largeur du Profil en mosaïque, selon le nombre de colonnes (SPEC § 3.3 et § 3.4). */
const PROFILE_WIDTH = { 2: 360, 3: 420 } as const;
/** Colonne de droite de la mosaïque 3 colonnes : IA puis Recos (SPEC § 3.4). */
const RIGHT_COLUMN_WIDTH = 380;
/** Part de la hauteur de XP en mosaïque 2 colonnes ; IA et Recos prennent le reste (SPEC § 3.3). */
const PORTABLE_EXPERIENCE_SHARE = 0.56;

/** Tuiles qui peuvent se poser sous la tuile agrandie : Profil et IA entre elles (SPEC § 4.2). */
function stackPartners(target: TileId): readonly TileId[] {
  if (target === 'profile') return ['ai'];
  return target === 'ai' ? ['profile'] : [];
}

/** Rang `index` d'une division de `total` en `count` parts égales, arrondies sans trou. */
function equalSlice(total: number, count: number, index: number): { offset: number; size: number } {
  const offset = Math.round((total * index) / count);
  return { offset, size: Math.round((total * (index + 1)) / count) - offset };
}

function tilesFrom(build: (id: TileId) => TileLayout): Record<TileId, TileLayout> {
  return {
    profile: build('profile'),
    experience: build('experience'),
    recommendations: build('recommendations'),
    ai: build('ai'),
  };
}

function tabsLayout(width: number): TabsLayout {
  if (width < BREAKPOINTS.tablet) {
    return { mode: 'tabs', device: 'mobile', column: { x: 0, width } };
  }
  return {
    mode: 'tabs',
    device: 'tablet',
    column: { x: Math.round((width - TABLET_COLUMN_WIDTH) / 2), width: TABLET_COLUMN_WIDTH },
  };
}

/** Rectangles de la mosaïque (aucune tuile agrandie), dans le repère de la zone. */
function mosaicRects(columns: 2 | 3, area: Rect, profileHeight: number): Record<TileId, Rect> {
  const left = area.x + GAP;
  const right = area.x + area.width - GAP;
  const height = area.height - 2 * GAP;
  const profileWidth = PROFILE_WIDTH[columns];
  const middleX = left + profileWidth + GAP;
  const profile = { x: left, y: GAP, width: profileWidth, height: profileHeight };

  if (columns === 3) {
    const rightX = right - RIGHT_COLUMN_WIDTH;
    const ai = equalSlice(height - GAP, 2, 0);
    const recommendations = equalSlice(height - GAP, 2, 1);
    return {
      profile,
      experience: { x: middleX, y: GAP, width: rightX - GAP - middleX, height },
      ai: { x: rightX, y: GAP, width: RIGHT_COLUMN_WIDTH, height: ai.size },
      recommendations: {
        x: rightX,
        y: GAP + recommendations.offset + GAP,
        width: RIGHT_COLUMN_WIDTH,
        height: recommendations.size,
      },
    };
  }

  const experienceHeight = Math.round((height - GAP) * PORTABLE_EXPERIENCE_SHARE);
  const lowerY = GAP + experienceHeight + GAP;
  const lowerHeight = height - GAP - experienceHeight;
  const lowerWidth = right - middleX - GAP;
  const ai = equalSlice(lowerWidth, 2, 0);
  const recommendations = equalSlice(lowerWidth, 2, 1);
  return {
    profile,
    experience: { x: middleX, y: GAP, width: right - middleX, height: experienceHeight },
    ai: { x: middleX, y: lowerY, width: ai.size, height: lowerHeight },
    recommendations: {
      x: middleX + recommendations.offset + GAP,
      y: lowerY,
      width: recommendations.size,
      height: lowerHeight,
    },
  };
}

/** Côté de sortie de `tile` quand `target` est agrandie : selon sa colonne, puis sa rangée. */
function pushDirection(tile: Rect, target: Rect): PushDirection {
  const horizontal = Math.sign(tile.x - target.x);
  if (horizontal === 1) return 'right';
  if (horizontal === -1) return 'left';
  return Math.sign(tile.y - target.y) === -1 ? 'top' : 'bottom';
}

/** La tuile à la même place sur l'autre axe, mais entièrement hors de la zone. */
function pushedOut(rect: Rect, direction: PushDirection, zone: Zone): Rect {
  switch (direction) {
    case 'left':
      return { ...rect, x: -rect.width };
    case 'right':
      return { ...rect, x: zone.width };
    case 'top':
      return { ...rect, y: -rect.height };
    case 'bottom':
      return { ...rect, y: zone.height };
  }
}

interface MosaicContext {
  zone: Zone;
  area: Rect;
  /** Largeur et hauteur disponibles à l'intérieur des marges. */
  innerWidth: number;
  innerHeight: number;
  mosaic: Record<TileId, Rect>;
  /**
   * Hauteur naturelle (contenu + barre de titre et bordures) à la largeur de tuile donnée ;
   * `Infinity` tant que le contenu n'est pas mesuré : la tuile prend alors toute la hauteur et
   * ne tient jamais dans une pile.
   */
  natural: (tile: TileId, tileWidth: number) => number;
}

/** Tuile agrandie, tuile empilée dessous, colonne latérale ou tuiles poussées hors zone. */
function expandedTiles(context: MosaicContext, target: TileId): Record<TileId, TileLayout> {
  const { zone, area, innerWidth, innerHeight, mosaic, natural } = context;
  const tileWidth = Math.min(innerWidth, EXPANDED_MAX_WIDTH);
  const sideWidth = innerWidth - tileWidth - GAP;
  const hasSide = sideWidth >= SIDE_MIN_WIDTH;
  const left = area.x + GAP;
  const x = hasSide ? left : left + Math.round((innerWidth - tileWidth) / 2);

  // XP prend toute la hauteur ; les autres, la hauteur de leur contenu si elle tient.
  const targetNatural = target === 'experience' ? Infinity : natural(target, tileWidth);
  const height = Math.min(innerHeight, targetNatural);

  // Profil et IA se posent l'un sous l'autre quand les deux tiennent en entier (SPEC § 4.2).
  const stackedPartner = (): { id: TileId; height: number } | undefined => {
    for (const id of stackPartners(target)) {
      const partnerNatural = natural(id, tileWidth);
      if (targetNatural + GAP + partnerNatural <= innerHeight) {
        return { id, height: partnerNatural };
      }
    }
    return undefined;
  };
  const stacked = stackedPartner();

  const others = TILE_ORDER.filter((id) => id !== target && id !== stacked?.id);
  const sideX = left + tileWidth + GAP;
  // D42 : seule XP reste ouverte dans la colonne latérale ; les autres se replient en bas, sur leur
  // barre de titre, et XP prend la hauteur libérée.
  const folded = others.filter((id) => id !== 'experience');
  const foldedBlock = folded.length * (FOLDED_HEIGHT + GAP);
  const sideExperienceHeight = Math.max(0, innerHeight - foldedBlock);

  const layoutOf = (id: TileId): TileLayout => {
    if (id === target) {
      return {
        id,
        rect: { x, y: GAP, width: tileWidth, height },
        visible: true,
        placement: 'expanded',
        push: null,
      };
    }
    if (id === stacked?.id) {
      const rect = { x, y: GAP + height + GAP, width: tileWidth, height: stacked.height };
      return { id, rect, visible: true, placement: 'stacked', push: null };
    }
    if (hasSide) {
      if (id === 'experience') {
        const rect = { x: sideX, y: GAP, width: sideWidth, height: sideExperienceHeight };
        return { id, rect, visible: true, placement: 'side', push: null };
      }
      const rect = {
        x: sideX,
        y: GAP + sideExperienceHeight + GAP + folded.indexOf(id) * (FOLDED_HEIGHT + GAP),
        width: sideWidth,
        height: FOLDED_HEIGHT,
      };
      return { id, rect, visible: true, placement: 'folded', push: null };
    }
    const direction = pushDirection(mosaic[id], mosaic[target]);
    return {
      id,
      rect: pushedOut(mosaic[id], direction, zone),
      visible: false,
      placement: 'pushed',
      push: direction,
    };
  };

  return tilesFrom(layoutOf);
}

function mosaicLayout(input: LayoutInput): MosaicLayout {
  const { zone, expanded, contentHeight } = input;
  const columns = zone.width >= BREAKPOINTS.desktop ? 3 : 2;
  const areaWidth = Math.min(zone.width, PAGE_MAX_WIDTH);
  const area: Rect = {
    x: Math.round((zone.width - areaWidth) / 2),
    y: 0,
    width: areaWidth,
    height: zone.height,
  };
  const innerWidth = areaWidth - 2 * GAP;
  const innerHeight = zone.height - 2 * GAP;
  const natural = (tile: TileId, tileWidth: number): number => {
    const content = contentHeight(tile, tileWidth - TILE_CHROME.width);
    return content === undefined ? Infinity : content + TILE_CHROME.height;
  };

  // SPEC § 4.1 : le Profil s'arrête à la hauteur de son contenu sur écran haut (3 colonnes), sinon
  // il prend toute la hauteur ; en 2 colonnes (SPEC § 3.3), toute la hauteur.
  const profileNatural = columns === 3 ? natural('profile', PROFILE_WIDTH[3]) : Infinity;
  const profileHeight = Math.min(innerHeight, profileNatural);
  const mosaic = mosaicRects(columns, area, profileHeight);
  const context: MosaicContext = { zone, area, innerWidth, innerHeight, mosaic, natural };

  const tiles =
    expanded === null
      ? tilesFrom((id) => ({
          id,
          rect: mosaic[id],
          visible: true,
          placement: 'mosaic',
          push: null,
        }))
      : expandedTiles(context, expanded);

  return { mode: 'mosaic', columns, area, expanded, tiles };
}

/**
 * Mise en page pour une zone et un état. En dessous de 1024 px : une section à la fois
 * (`tabs`, mobile < 768 px, tablette ensuite). À partir de 1024 px : mosaïque, 2 colonnes jusqu'à
 * 1199 px, 3 colonnes ensuite, zone plafonnée à 1440 px et centrée.
 */
export function computeLayout(input: LayoutInput): Layout {
  return input.zone.width < BREAKPOINTS.portable
    ? tabsLayout(input.zone.width)
    : mosaicLayout(input);
}
