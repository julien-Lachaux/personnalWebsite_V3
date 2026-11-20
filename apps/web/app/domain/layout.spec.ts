import { describe, expect, it } from 'vitest';
import {
  BREAKPOINTS,
  EXPANDED_MAX_WIDTH,
  GAP,
  PAGE_MAX_WIDTH,
  SIDE_MIN_WIDTH,
  TABLET_COLUMN_WIDTH,
  TILE_CHROME,
  TILE_ORDER,
  computeLayout,
} from './layout.js';
import type { ContentHeight, MosaicLayout, Rect, TileId, TileLayout } from './layout-types.js';

type Heights = Partial<Record<TileId, number>>;

/** Hauteur de contenu indépendante de la largeur ; une tuile absente n'est pas mesurée. */
function heights(values: Heights): ContentHeight {
  return (tile) => values[tile];
}

const NOTHING_MEASURED = heights({});

function mosaic(
  zone: { width: number; height: number },
  options: { expanded?: TileId | null; textEnlarged?: boolean; contentHeight?: ContentHeight } = {},
): MosaicLayout {
  const layout = computeLayout({
    zone,
    expanded: options.expanded ?? null,
    textEnlarged: options.textEnlarged ?? false,
    contentHeight: options.contentHeight ?? NOTHING_MEASURED,
  });
  if (layout.mode !== 'mosaic') throw new Error(`mosaïque attendue : ${layout.mode}`);
  return layout;
}

function rects(layout: MosaicLayout): Record<TileId, Rect> {
  return {
    profile: layout.tiles.profile.rect,
    experience: layout.tiles.experience.rect,
    recommendations: layout.tiles.recommendations.rect,
    ai: layout.tiles.ai.rect,
  };
}

function tile(layout: MosaicLayout, id: TileId): TileLayout {
  return layout.tiles[id];
}

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

describe('constantes', () => {
  it('reprennent les valeurs de la spécification et des tokens', () => {
    expect(TILE_ORDER).toEqual(['profile', 'experience', 'recommendations', 'ai']);
    expect(GAP).toBe(12);
    expect(PAGE_MAX_WIDTH).toBe(1440);
    expect(EXPANDED_MAX_WIDTH).toBe(868);
    expect(SIDE_MIN_WIDTH).toBe(340);
    expect(TABLET_COLUMN_WIDTH).toBe(640);
    expect(BREAKPOINTS).toEqual({ tablet: 768, portable: 1024, desktop: 1200 });
    expect(TILE_CHROME).toEqual({ width: 3, height: 48 });
  });
});

describe('mode selon la largeur', () => {
  const tabs = (width: number) =>
    computeLayout({
      zone: { width, height: 700 },
      expanded: 'experience',
      textEnlarged: false,
      contentHeight: NOTHING_MEASURED,
    });

  it('mobile sous 768 px : onglets sur toute la largeur', () => {
    expect(tabs(390)).toEqual({ mode: 'tabs', device: 'mobile', column: { x: 0, width: 390 } });
    expect(tabs(767)).toEqual({ mode: 'tabs', device: 'mobile', column: { x: 0, width: 767 } });
  });

  it('tablette de 768 à 1023 px : onglets, colonne de 640 px centrée', () => {
    expect(tabs(768)).toEqual({
      mode: 'tabs',
      device: 'tablet',
      column: { x: 64, width: 640 },
    });
    // Capture tablette 834 : marge de 97 px de chaque côté.
    expect(tabs(834)).toEqual({ mode: 'tabs', device: 'tablet', column: { x: 97, width: 640 } });
    // Largeur impaire : la marge à gauche est arrondie.
    expect(tabs(769)).toMatchObject({ column: { x: 65, width: 640 } });
    expect(tabs(1023)).toMatchObject({ device: 'tablet', column: { x: 192, width: 640 } });
  });

  it('mosaïque à 2 colonnes de 1024 à 1199 px', () => {
    expect(mosaic({ width: 1024, height: 712 }).columns).toBe(2);
    expect(mosaic({ width: 1199, height: 712 }).columns).toBe(2);
  });

  it('mosaïque à 3 colonnes à partir de 1200 px', () => {
    expect(mosaic({ width: 1200, height: 712 }).columns).toBe(3);
    expect(mosaic({ width: 3440, height: 1384 }).columns).toBe(3);
  });
});

describe('mosaïque 3 colonnes', () => {
  it('desktop 1280×844 : Profil pleine hauteur (contenu plus haut que la zone), XP, IA puis Recos', () => {
    // Zone sous la barre de 56 px : 1280×788. Capture desktop-1280_mosaique : IA et Recos de 376 px.
    const asked: [TileId, number][] = [];
    const layout = mosaic(
      { width: 1280, height: 788 },
      {
        contentHeight: (id, width) => {
          asked.push([id, width]);
          return id === 'profile' ? 900 : undefined;
        },
      },
    );
    expect(rects(layout)).toEqual({
      profile: r(12, 12, 420, 764),
      experience: r(444, 12, 432, 764),
      ai: r(888, 12, 380, 376),
      recommendations: r(888, 400, 380, 376),
    });
    expect(layout.area).toEqual(r(0, 0, 1280, 788));
    expect(layout.expanded).toBeNull();
    expect(layout.columns).toBe(3);
    // Le Profil est mesuré à sa largeur intérieure (420 px moins les bordures) et lui seul.
    expect(asked).toEqual([['profile', 417]]);
  });

  it('marque toutes les tuiles visibles, en place de mosaïque, sans poussée', () => {
    const layout = mosaic({ width: 1280, height: 788 });
    for (const id of TILE_ORDER) {
      expect(tile(layout, id)).toMatchObject({
        id,
        visible: true,
        placement: 'mosaic',
        push: null,
      });
    }
  });

  it('donne au Profil la hauteur de son contenu sur un écran haut', () => {
    // 1280×1056 : zone de 1000 px, contenu du Profil de 700 px, plus 48 px de chrome.
    const layout = mosaic(
      { width: 1280, height: 1000 },
      { contentHeight: heights({ profile: 700 }) },
    );
    expect(rects(layout)).toEqual({
      profile: r(12, 12, 420, 748),
      experience: r(444, 12, 432, 976),
      ai: r(888, 12, 380, 482),
      recommendations: r(888, 506, 380, 482),
    });
    expect(layout.profile).toEqual({ mode: 'reduced', contentWidth: 417, availableHeight: 700 });
  });

  it('donne au Profil toute la hauteur quand sa hauteur n’est pas encore mesurée', () => {
    const layout = mosaic({ width: 1280, height: 1000 });
    expect(tile(layout, 'profile').rect).toEqual(r(12, 12, 420, 976));
  });

  it('plafonne la hauteur du Profil à la zone quand le contenu la dépasse de peu', () => {
    // Contenu 716 + 48 = 764 = hauteur de la zone : pile pleine hauteur.
    expect(
      tile(
        mosaic({ width: 1280, height: 788 }, { contentHeight: heights({ profile: 716 }) }),
        'profile',
      ).rect.height,
    ).toBe(764);
    expect(
      tile(
        mosaic({ width: 1280, height: 788 }, { contentHeight: heights({ profile: 715 }) }),
        'profile',
      ).rect.height,
    ).toBe(763);
    expect(
      tile(
        mosaic({ width: 1280, height: 788 }, { contentHeight: heights({ profile: 717 }) }),
        'profile',
      ).rect.height,
    ).toBe(764);
  });

  it('indique pour le Profil la largeur et la hauteur à passer à fit', () => {
    const layout = mosaic(
      { width: 1280, height: 788 },
      { contentHeight: heights({ profile: 900 }) },
    );
    expect(layout.profile).toEqual({ mode: 'reduced', contentWidth: 417, availableHeight: 716 });
  });

  it('desktop à 1200 px : XP étroite (352 px), colonnes fixes de 420 et 380 px', () => {
    const layout = mosaic({ width: 1200, height: 700 });
    expect(rects(layout)).toEqual({
      profile: r(12, 12, 420, 676),
      experience: r(444, 12, 352, 676),
      ai: r(808, 12, 380, 332),
      recommendations: r(808, 356, 380, 332),
    });
  });

  it('répartit une hauteur impaire sans trou ni recouvrement', () => {
    const layout = mosaic({ width: 1280, height: 789 });
    const { ai, recommendations } = rects(layout);
    expect(ai).toEqual(r(888, 12, 380, 377));
    expect(recommendations).toEqual(r(888, 401, 380, 376));
    expect(recommendations.y + recommendations.height).toBe(789 - GAP);
  });

  it('grand écran 1440×900 : zone de 1440 px, XP de 592 px', () => {
    const layout = mosaic({ width: 1440, height: 844 });
    expect(layout.area).toEqual(r(0, 0, 1440, 844));
    expect(rects(layout)).toEqual({
      profile: r(12, 12, 420, 820),
      experience: r(444, 12, 592, 820),
      ai: r(1048, 12, 380, 404),
      recommendations: r(1048, 428, 380, 404),
    });
  });

  it('Full HD 1920×1080 : zone plafonnée à 1440 px et centrée', () => {
    const layout = mosaic({ width: 1920, height: 1024 });
    expect(layout.area).toEqual(r(240, 0, 1440, 1024));
    expect(rects(layout)).toEqual({
      profile: r(252, 12, 420, 1000),
      experience: r(684, 12, 592, 1000),
      ai: r(1288, 12, 380, 494),
      recommendations: r(1288, 518, 380, 494),
    });
  });

  it('écran 3440×1440 : même zone de 1440 px, décalée de 1000 px', () => {
    const layout = mosaic({ width: 3440, height: 1384 });
    expect(layout.area).toEqual(r(1000, 0, 1440, 1384));
    expect(tile(layout, 'profile').rect.x).toBe(1012);
    expect(tile(layout, 'ai').rect.x).toBe(2048);
  });

  it('arrondit le décalage de la zone centrée', () => {
    expect(mosaic({ width: 1921, height: 1000 }).area.x).toBe(241);
    expect(mosaic({ width: 1920, height: 1000 }).area.x).toBe(240);
  });

  it('désactive la réduction du Profil quand le texte est agrandi, sans changer sa hauteur', () => {
    const layout = mosaic(
      { width: 1280, height: 788 },
      { textEnlarged: true, contentHeight: heights({ profile: 900 }) },
    );
    expect(layout.profile).toEqual({ mode: 'scrolling', contentWidth: 417, availableHeight: 716 });
    expect(tile(layout, 'profile').rect.height).toBe(764);
  });
});

describe('mosaïque 2 colonnes', () => {
  it('portable 1024×768 : Profil 360 px pleine hauteur, XP à 56 %, IA et Recos côte à côte', () => {
    const layout = mosaic({ width: 1024, height: 712 });
    expect(rects(layout)).toEqual({
      profile: r(12, 12, 360, 688),
      experience: r(384, 12, 628, 379),
      ai: r(384, 403, 308, 297),
      recommendations: r(704, 403, 308, 297),
    });
    expect(layout.area).toEqual(r(0, 0, 1024, 712));
    expect(layout.profile).toEqual({ mode: 'reduced', contentWidth: 357, availableHeight: 640 });
  });

  it('ne mesure pas le Profil et ne le raccourcit pas, même avec un contenu court', () => {
    const asked: [TileId, number][] = [];
    const layout = mosaic(
      { width: 1024, height: 712 },
      {
        contentHeight: (id, width) => {
          asked.push([id, width]);
          return 100;
        },
      },
    );
    expect(tile(layout, 'profile').rect.height).toBe(688);
    expect(asked).toEqual([]);
  });

  it('remplit exactement la zone, au pixel près, pour des hauteurs et largeurs impaires', () => {
    const layout = mosaic({ width: 1101, height: 701 });
    const { experience, ai, recommendations } = rects(layout);
    expect(experience.y + experience.height + GAP).toBe(ai.y);
    expect(ai.y + ai.height).toBe(701 - GAP);
    expect(ai.x + ai.width + GAP).toBe(recommendations.x);
    expect(recommendations.x + recommendations.width).toBe(1101 - GAP);
    expect(ai.width).toBe(Math.round((1101 - 408) / 2));
    expect(recommendations.width).toBe(1101 - 408 - ai.width);
  });
});

describe('tuile agrandie avec colonne latérale (desktop)', () => {
  it('XP agrandie à 1280×844 : tuile de 868 px à gauche, trois tuiles à parts égales à droite', () => {
    // Capture desktop-1280_xp-agrandi : place restante de 376 px (au moins 340).
    const layout = mosaic({ width: 1280, height: 788 }, { expanded: 'experience' });
    expect(rects(layout)).toEqual({
      experience: r(12, 12, 868, 764),
      profile: r(892, 12, 376, 247),
      recommendations: r(892, 271, 376, 246),
      ai: r(892, 529, 376, 247),
    });
    expect(layout.expanded).toBe('experience');
    expect(tile(layout, 'experience')).toMatchObject({
      visible: true,
      placement: 'expanded',
      push: null,
    });
    for (const id of ['profile', 'recommendations', 'ai'] as const) {
      expect(tile(layout, id)).toMatchObject({ visible: true, placement: 'side', push: null });
    }
    // La colonne latérale se termine à la marge basse de la zone.
    expect(529 + 247).toBe(788 - GAP);
  });

  it('place le Profil de la colonne latérale en taille normale, avec défilement', () => {
    const layout = mosaic({ width: 1280, height: 788 }, { expanded: 'experience' });
    expect(layout.profile).toEqual({ mode: 'scrolling', contentWidth: 373, availableHeight: 199 });
  });

  it('accepte la colonne latérale à 340 px exactement, la refuse à 339 px', () => {
    // Zone 1244 px : 1244 − 24 − 868 − 12 = 340.
    const withSide = mosaic({ width: 1244, height: 788 }, { expanded: 'experience' });
    expect(tile(withSide, 'profile')).toMatchObject({
      placement: 'side',
      rect: r(892, 12, 340, 247),
    });
    const without = mosaic({ width: 1243, height: 788 }, { expanded: 'experience' });
    expect(tile(without, 'profile').placement).toBe('pushed');
  });

  it('IA agrandie : la colonne latérale reprend l’ordre Profil, XP, Recos', () => {
    const layout = mosaic({ width: 1280, height: 788 }, { expanded: 'ai' });
    expect(tile(layout, 'ai')).toMatchObject({ placement: 'expanded', rect: r(12, 12, 868, 764) });
    expect(tile(layout, 'profile').rect.y).toBe(12);
    expect(tile(layout, 'experience').rect.y).toBe(271);
    expect(tile(layout, 'recommendations').rect.y).toBe(529);
  });

  it('Recos agrandie à la hauteur de son contenu, ou pleine hauteur sans mesure', () => {
    const measured = mosaic(
      { width: 1280, height: 788 },
      { expanded: 'recommendations', contentHeight: heights({ recommendations: 300 }) },
    );
    expect(tile(measured, 'recommendations').rect).toEqual(r(12, 12, 868, 348));
    const unmeasured = mosaic({ width: 1280, height: 788 }, { expanded: 'recommendations' });
    expect(tile(unmeasured, 'recommendations').rect).toEqual(r(12, 12, 868, 764));
  });

  it('plafonne à la zone la tuile dont le contenu est trop haut', () => {
    const layout = mosaic(
      { width: 1280, height: 788 },
      { expanded: 'recommendations', contentHeight: heights({ recommendations: 2000 }) },
    );
    expect(tile(layout, 'recommendations').rect.height).toBe(764);
  });

  it('XP agrandie ignore la hauteur de son contenu : toujours pleine hauteur', () => {
    const asked: TileId[] = [];
    const layout = mosaic(
      { width: 1280, height: 788 },
      {
        expanded: 'experience',
        contentHeight: (id) => {
          asked.push(id);
          return 100;
        },
      },
    );
    expect(tile(layout, 'experience').rect.height).toBe(764);
    expect(asked).not.toContain('experience');
  });

  it('mesure la tuile agrandie à sa largeur intérieure de 865 px', () => {
    const asked: [TileId, number][] = [];
    mosaic(
      { width: 1280, height: 788 },
      {
        expanded: 'recommendations',
        contentHeight: (id, width) => {
          asked.push([id, width]);
          return 300;
        },
      },
    );
    // Le Profil est aussi mesuré à sa largeur de mosaïque (sa place si la tuile redevient réduite).
    expect(asked).toEqual([
      ['profile', 417],
      ['recommendations', 865],
    ]);
  });

  it('grand écran 1440 : la colonne latérale gagne en largeur, jamais la tuile agrandie', () => {
    const layout = mosaic({ width: 1440, height: 844 }, { expanded: 'experience' });
    expect(tile(layout, 'experience').rect).toEqual(r(12, 12, 868, 820));
    expect(tile(layout, 'profile').rect).toMatchObject({ x: 892, width: 536 });
  });

  it('Full HD : la colonne latérale est décalée avec la zone centrée', () => {
    const layout = mosaic({ width: 1920, height: 1024 }, { expanded: 'experience' });
    expect(tile(layout, 'experience').rect).toEqual(r(252, 12, 868, 1000));
    expect(tile(layout, 'profile').rect).toMatchObject({ x: 1132, width: 536 });
  });
});

describe('empilement Profil et IA', () => {
  // Contenus à 865 px : le Profil de 250 px et l'IA de 200 px, plus 48 px de chrome chacun.
  const both = heights({ profile: 250, ai: 200 });

  it('Profil agrandi : l’IA vient dessous à la même largeur, le reste passe à droite', () => {
    const layout = mosaic(
      { width: 1280, height: 788 },
      { expanded: 'profile', contentHeight: both },
    );
    expect(rects(layout)).toEqual({
      profile: r(12, 12, 868, 298),
      ai: r(12, 322, 868, 248),
      experience: r(892, 12, 376, 376),
      recommendations: r(892, 400, 376, 376),
    });
    expect(tile(layout, 'ai')).toMatchObject({ placement: 'stacked', visible: true, push: null });
    expect(tile(layout, 'experience').placement).toBe('side');
    // Le Profil agrandi reste réductible, à la hauteur de son contenu.
    expect(layout.profile).toEqual({ mode: 'reduced', contentWidth: 865, availableHeight: 250 });
  });

  it('IA agrandie : le Profil vient dessous', () => {
    const layout = mosaic({ width: 1280, height: 788 }, { expanded: 'ai', contentHeight: both });
    expect(tile(layout, 'ai')).toMatchObject({ placement: 'expanded', rect: r(12, 12, 868, 248) });
    expect(tile(layout, 'profile')).toMatchObject({
      placement: 'stacked',
      rect: r(12, 272, 868, 298),
    });
    expect(layout.profile).toEqual({ mode: 'reduced', contentWidth: 865, availableHeight: 250 });
  });

  it('empile quand la somme des deux tuiles et de la gouttière égale la hauteur disponible', () => {
    // 764 = 12 + 448 + 304 : Profil 400 + 48, IA 256 + 48.
    const exact = mosaic(
      { width: 1280, height: 788 },
      { expanded: 'profile', contentHeight: heights({ profile: 400, ai: 256 }) },
    );
    expect(tile(exact, 'ai').placement).toBe('stacked');
    const tooTall = mosaic(
      { width: 1280, height: 788 },
      { expanded: 'profile', contentHeight: heights({ profile: 400, ai: 257 }) },
    );
    expect(tile(tooTall, 'ai').placement).toBe('side');
  });

  it('n’empile pas quand les deux ne tiennent pas : le Profil est plafonné et l’IA va à droite', () => {
    const layout = mosaic(
      { width: 1280, height: 788 },
      { expanded: 'profile', contentHeight: heights({ profile: 900, ai: 300 }) },
    );
    expect(tile(layout, 'profile')).toMatchObject({
      placement: 'expanded',
      rect: r(12, 12, 868, 764),
    });
    expect(tile(layout, 'ai').placement).toBe('side');
    expect(layout.profile).toEqual({ mode: 'reduced', contentWidth: 865, availableHeight: 716 });
  });

  it('n’empile pas tant que l’autre tuile n’est pas mesurée', () => {
    const profileOnly = mosaic(
      { width: 1280, height: 788 },
      { expanded: 'profile', contentHeight: heights({ profile: 250 }) },
    );
    expect(tile(profileOnly, 'ai').placement).toBe('side');
    expect(tile(profileOnly, 'profile').rect.height).toBe(298);
    const aiOnly = mosaic(
      { width: 1280, height: 788 },
      { expanded: 'profile', contentHeight: heights({ ai: 200 }) },
    );
    expect(tile(aiOnly, 'ai').placement).toBe('side');
    expect(tile(aiOnly, 'profile').rect.height).toBe(764);
  });

  it('n’empile jamais XP ni Recos agrandies, même avec des contenus courts', () => {
    for (const expanded of ['experience', 'recommendations'] as const) {
      const layout = mosaic({ width: 1280, height: 788 }, { expanded, contentHeight: () => 100 });
      for (const id of TILE_ORDER) {
        expect(tile(layout, id).placement, `${expanded}/${id}`).not.toBe('stacked');
      }
    }
  });

  it('centre la pile sans colonne latérale et pousse les autres tuiles', () => {
    // Portable 1024×712 : pas de place à côté, Profil agrandi + IA dessous.
    const layout = mosaic(
      { width: 1024, height: 712 },
      { expanded: 'profile', contentHeight: both },
    );
    expect(tile(layout, 'profile')).toMatchObject({
      placement: 'expanded',
      rect: r(78, 12, 868, 298),
    });
    expect(tile(layout, 'ai')).toMatchObject({ placement: 'stacked', rect: r(78, 322, 868, 248) });
    expect(tile(layout, 'experience')).toMatchObject({ placement: 'pushed', push: 'right' });
    expect(tile(layout, 'recommendations')).toMatchObject({ placement: 'pushed', push: 'right' });
  });
});

describe('tuile agrandie sans place latérale (poussée)', () => {
  it('XP agrandie à 1024×768 : tuile centrée, les autres sortent par la gauche, le bas et la droite', () => {
    // Capture portable-1024_xp-agrandi : 868 px de large, centrée.
    const layout = mosaic({ width: 1024, height: 712 }, { expanded: 'experience' });
    expect(tile(layout, 'experience')).toMatchObject({
      placement: 'expanded',
      visible: true,
      rect: r(78, 12, 868, 688),
    });
    expect(tile(layout, 'profile')).toEqual({
      id: 'profile',
      rect: r(-360, 12, 360, 688),
      visible: false,
      placement: 'pushed',
      push: 'left',
    });
    expect(tile(layout, 'ai')).toEqual({
      id: 'ai',
      rect: r(384, 712, 308, 297),
      visible: false,
      placement: 'pushed',
      push: 'bottom',
    });
    expect(tile(layout, 'recommendations')).toEqual({
      id: 'recommendations',
      rect: r(1024, 403, 308, 297),
      visible: false,
      placement: 'pushed',
      push: 'right',
    });
  });

  it('garde le Profil poussé à sa géométrie de mosaïque pour son facteur S', () => {
    const layout = mosaic({ width: 1024, height: 712 }, { expanded: 'experience' });
    expect(layout.profile).toEqual({ mode: 'reduced', contentWidth: 357, availableHeight: 640 });
  });

  it('IA agrandie à 1024 : XP sort par le haut, Profil par la gauche, Recos par la droite', () => {
    const layout = mosaic({ width: 1024, height: 712 }, { expanded: 'ai' });
    expect(tile(layout, 'experience')).toMatchObject({ push: 'top', rect: r(384, -379, 628, 379) });
    expect(tile(layout, 'profile').push).toBe('left');
    expect(tile(layout, 'recommendations').push).toBe('right');
  });

  it('Recos agrandie à 1024 : toutes les autres sortent par la gauche', () => {
    const layout = mosaic({ width: 1024, height: 712 }, { expanded: 'recommendations' });
    for (const id of ['profile', 'experience', 'ai'] as const) {
      expect(tile(layout, id), id).toMatchObject({
        placement: 'pushed',
        visible: false,
        push: 'left',
      });
    }
    expect(tile(layout, 'recommendations').rect).toEqual(r(78, 12, 868, 688));
  });

  it('Profil agrandi à 1024 sans contenu mesuré : XP, IA et Recos sortent par la droite', () => {
    const layout = mosaic({ width: 1024, height: 712 }, { expanded: 'profile' });
    for (const id of ['experience', 'ai', 'recommendations'] as const) {
      expect(tile(layout, id), id).toMatchObject({ placement: 'pushed', push: 'right' });
    }
    expect(tile(layout, 'profile').rect).toEqual(r(78, 12, 868, 688));
  });

  it('3 colonnes sans place latérale (1200 px) : Recos sort sous IA, IA au-dessus de Recos', () => {
    const iaMax = mosaic({ width: 1200, height: 700 }, { expanded: 'ai' });
    expect(tile(iaMax, 'recommendations')).toMatchObject({
      push: 'bottom',
      rect: r(808, 700, 380, 332),
    });
    expect(tile(iaMax, 'experience').push).toBe('left');
    expect(tile(iaMax, 'profile').push).toBe('left');
    const recosMax = mosaic({ width: 1200, height: 700 }, { expanded: 'recommendations' });
    expect(tile(recosMax, 'ai')).toMatchObject({ push: 'top', rect: r(808, -332, 380, 332) });
  });

  it('3 colonnes sans place latérale : XP agrandie, Profil à gauche, IA et Recos à droite', () => {
    const layout = mosaic({ width: 1200, height: 700 }, { expanded: 'experience' });
    expect(tile(layout, 'profile')).toMatchObject({ push: 'left', rect: r(-420, 12, 420, 676) });
    expect(tile(layout, 'ai')).toMatchObject({ push: 'right', rect: r(1200, 12, 380, 332) });
    expect(tile(layout, 'recommendations')).toMatchObject({
      push: 'right',
      rect: r(1200, 356, 380, 332),
    });
    expect(tile(layout, 'experience').rect).toEqual(r(166, 12, 868, 676));
  });

  it('pousse les tuiles entièrement hors de la zone, quelle que soit leur largeur', () => {
    const layout = mosaic({ width: 1243, height: 788 }, { expanded: 'experience' });
    expect(tile(layout, 'profile').rect.x).toBe(-420);
    expect(tile(layout, 'ai').rect.x).toBe(1243);
  });

  it('centre la tuile agrandie en arrondissant la marge', () => {
    // Zone 1025 : 1001 − 868 = 133, soit 66,5 px de marge à gauche, arrondis à 67.
    expect(
      tile(mosaic({ width: 1025, height: 700 }, { expanded: 'experience' }), 'experience').rect.x,
    ).toBe(79);
    expect(
      tile(mosaic({ width: 1024, height: 700 }, { expanded: 'experience' }), 'experience').rect.x,
    ).toBe(78);
  });
});

describe('texte agrandi et tuile agrandie', () => {
  it('garde la colonne latérale et le défilement du Profil', () => {
    const layout = mosaic(
      { width: 1280, height: 788 },
      { expanded: 'experience', textEnlarged: true },
    );
    expect(layout.profile.mode).toBe('scrolling');
  });

  it('désactive aussi la réduction du Profil agrandi', () => {
    const layout = mosaic(
      { width: 1280, height: 788 },
      { expanded: 'profile', textEnlarged: true, contentHeight: heights({ profile: 900 }) },
    );
    expect(layout.profile).toEqual({ mode: 'scrolling', contentWidth: 865, availableHeight: 716 });
  });
});

describe('mode onglets', () => {
  it('ignore la tuile agrandie et les mesures', () => {
    const layout = computeLayout({
      zone: { width: 390, height: 700 },
      expanded: 'profile',
      textEnlarged: true,
      contentHeight: () => {
        throw new Error('aucune mesure attendue');
      },
    });
    expect(layout.mode).toBe('tabs');
  });
});
