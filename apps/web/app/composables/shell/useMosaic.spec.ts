import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { computeLayout } from '../../domain/layout.js';
import type { MosaicLayout, TileId, Zone } from '../../domain/layout-types.js';
import { CHROME_EXTRA, CONTENT_MAX_WIDTH, useMosaic, type MeasureContent } from './useMosaic.js';

// État de la mosaïque (lot F6) : mesures faites d'avance pour les cinq états, rendu sans mesure,
// Profil sans réduction (D41), transitions coupées hors agrandissement. La mesure du DOM est remplacée par une fonction.

const DESKTOP: Zone = { width: 1280, height: 788 };

/** Profil dont le texte se recompose (surface constante), autres contenus de hauteur fixe. */
function content(profileArea: number, others = 300): MeasureContent {
  return (tile, width) => (tile === 'profile' ? profileArea / width : others);
}

/** La mise en page attendue, calculée par le domaine avec les mêmes mesures arrondies. */
function expected(zone: Zone, expanded: TileId | null, measure: MeasureContent): MosaicLayout {
  const layout = computeLayout({
    zone,
    expanded,
    contentHeight: (tile, innerWidth) =>
      Math.ceil(measure(tile, Math.min(innerWidth, CONTENT_MAX_WIDTH)) + CHROME_EXTRA),
  });
  if (layout.mode !== 'mosaic') throw new Error('mosaïque attendue');
  return layout;
}

/** Images d'animation déclenchées à la main. */
let frames: FrameRequestCallback[] = [];

function nextFrame(): void {
  const pending = frames;
  frames = [];
  for (const callback of pending) callback(0);
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames[id - 1] = () => undefined;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(measure: MeasureContent) {
  const expanded = ref<TileId | null>(null);
  const spy = vi.fn(measure);
  return { expanded, spy, mosaic: useMosaic(expanded, spy) };
}

describe('useMosaic : zone', () => {
  it('rien avant la première zone : pas de mise en page, transitions coupées', () => {
    const { mosaic, spy } = setup(content(200_000));

    expect(mosaic.layout.value).toBeNull();
    expect(mosaic.instant.value).toBe(true);
    mosaic.remeasure();
    expect(spy).not.toHaveBeenCalled();
  });

  it('pose la mosaïque de computeLayout avec les hauteurs mesurées (arrondies, + 0,5 px de décor)', () => {
    const measure = content(200_000);
    const { mosaic } = setup(measure);

    mosaic.setZone(DESKTOP);

    expect(mosaic.layout.value).toEqual(expected(DESKTOP, null, measure));
    // Profil à la hauteur de son contenu (3 colonnes) : 200000 / 417 = 479,6 → 481 + 48.
    expect(mosaic.layout.value?.tiles.profile.rect.height).toBe(529);
  });

  it('sous 1024 px : aucune mosaïque', () => {
    const { mosaic } = setup(content(200_000));

    mosaic.setZone(DESKTOP);
    mosaic.setZone({ width: 900, height: 700 });

    expect(mosaic.layout.value).toBeNull();
  });

  it('même zone : rien n’est remesuré ni recalculé', () => {
    const { mosaic, spy } = setup(content(200_000));
    mosaic.setZone(DESKTOP);
    const layout = mosaic.layout.value;
    const calls = spy.mock.calls.length;
    nextFrame();
    nextFrame();

    mosaic.setZone({ ...DESKTOP });

    expect(spy).toHaveBeenCalledTimes(calls);
    expect(mosaic.layout.value).toBe(layout);
    expect(mosaic.instant.value).toBe(false);
  });
});

describe('useMosaic : aucun recalcul visible', () => {
  for (const tile of ['profile', 'experience', 'recommendations', 'ai'] as const) {
    it(`agrandir ${tile} : tout est déjà mesuré, la géométrie finale est celle du domaine`, () => {
      const measure = content(200_000);
      const { mosaic, spy, expanded } = setup(measure);
      mosaic.setZone(DESKTOP);
      const calls = spy.mock.calls.length;

      expanded.value = tile;

      expect(mosaic.layout.value).toEqual(expected(DESKTOP, tile, measure));
      expect(spy).toHaveBeenCalledTimes(calls);
    });
  }

  it('mesure chaque contenu une fois par largeur, à la largeur intérieure plafonnée à 820 px', () => {
    const { mosaic, spy } = setup(content(200_000));

    mosaic.setZone({ width: 1920, height: 1000 });

    const widths = spy.mock.calls
      .filter(([tile]) => tile !== 'profile')
      .map(([tile, width]) => `${tile}@${width}`);
    // Tuile agrandie de 868 px (865 de contenu, plafonné à 820) ; XP n'est jamais mesurée.
    expect(widths.toSorted()).toEqual(['ai@820', 'recommendations@820']);
  });
});

describe('useMosaic : Profil sans réduction (D41)', () => {
  it('Profil plus long que la zone : tuile pleine hauteur, le contenu garde sa taille et défile', () => {
    const { mosaic } = setup(content(600_000));

    mosaic.setZone(DESKTOP);

    expect(mosaic.layout.value?.tiles.profile.rect.height).toBe(764);
  });

  it('XP agrandie : le Profil prend la colonne latérale (D42), Recos et IA se replient', () => {
    const { mosaic, expanded } = setup(content(600_000));
    mosaic.setZone(DESKTOP);

    expanded.value = 'experience';

    const { tiles } = mosaic.layout.value!;
    expect(tiles.profile.placement).toBe('side');
    expect(tiles.recommendations.placement).toBe('folded');
    expect(tiles.ai.placement).toBe('folded');
  });
});

describe('useMosaic : transitions', () => {
  it('coupées pendant deux images après une nouvelle zone, puis rendues', () => {
    const { mosaic } = setup(content(200_000));

    mosaic.setZone(DESKTOP);
    expect(mosaic.instant.value).toBe(true);
    nextFrame();
    expect(mosaic.instant.value).toBe(true);
    nextFrame();
    expect(mosaic.instant.value).toBe(false);
  });

  it('une nouvelle zone pendant l’attente relance les deux images', () => {
    const { mosaic } = setup(content(200_000));
    mosaic.setZone(DESKTOP);
    nextFrame();

    mosaic.setZone({ width: 1440, height: 844 });
    nextFrame();
    expect(mosaic.instant.value).toBe(true);
    nextFrame();
    expect(mosaic.instant.value).toBe(false);
  });

  it('agrandir ne les coupe pas', () => {
    const { mosaic, expanded } = setup(content(200_000));
    mosaic.setZone(DESKTOP);
    nextFrame();
    nextFrame();

    expanded.value = 'ai';
    void mosaic.layout.value;

    expect(mosaic.instant.value).toBe(false);
  });
});

describe('useMosaic : nouvelles mesures', () => {
  it('contenu inchangé : remesuré, mais rien ne change ni ne coupe les transitions', () => {
    const { mosaic, spy } = setup(content(200_000));
    mosaic.setZone(DESKTOP);
    const layout = mosaic.layout.value;
    nextFrame();
    nextFrame();
    const calls = spy.mock.calls.length;

    mosaic.remeasure();

    expect(spy.mock.calls.length).toBeGreaterThan(calls);
    expect(mosaic.layout.value).toBe(layout);
    expect(mosaic.instant.value).toBe(false);
  });

  it('contenu changé (polices, réglages) : nouvelle mise en page, sans animation', () => {
    let area = 200_000;
    const { mosaic } = setup((tile, width) => (tile === 'profile' ? area / width : 300));
    mosaic.setZone(DESKTOP);
    nextFrame();
    nextFrame();

    area = 220_000;
    mosaic.remeasure();

    expect(mosaic.layout.value).toEqual(expected(DESKTOP, null, content(220_000)));
    expect(mosaic.instant.value).toBe(true);
  });
});
