import { describe, expect, it } from 'vitest';
import {
  FIT_ITERATIONS,
  FIT_MAX_CONTENT_WIDTH,
  FIT_MIN_SCALE,
  FIT_PRECISION,
  FIT_TOLERANCE,
  computeFit,
  createFitCache,
  type MeasureHeight,
} from './fit.js';

/** Mesure instrumentée : enregistre chaque largeur demandée. */
function recorded(height: MeasureHeight): { measure: MeasureHeight; widths: number[] } {
  const widths: number[] = [];
  return {
    widths,
    measure: (width) => {
      widths.push(width);
      return height(width);
    },
  };
}

/** Texte qui se recompose : une surface fixe et un cadre fixe, donc plus haut quand il est étroit. */
const wrapping =
  (area: number, frame: number): MeasureHeight =>
  (width) =>
    area / width + frame;

/** Plus grand S exact d'un contenu `wrapping` élargi à `width / S` : (area/width) S² + frame S = available. */
function exactScale(area: number, frame: number, width: number, available: number): number {
  const a = area / width;
  return (-frame + Math.sqrt(frame * frame + 4 * a * available)) / (2 * a);
}

describe('constantes', () => {
  it('reprennent les valeurs de la spécification', () => {
    expect(FIT_MIN_SCALE).toBe(0.6);
    expect(FIT_ITERATIONS).toBe(10);
    expect(FIT_TOLERANCE).toBe(0.5);
    expect(FIT_PRECISION).toBe(1000);
    expect(FIT_MAX_CONTENT_WIDTH).toBe(820);
  });
});

describe('computeFit', () => {
  it('rend S = 1 sans élargissement quand le contenu tient, avec une seule mesure', () => {
    const { measure, widths } = recorded(() => 600);
    expect(computeFit(measure, { width: 417, availableHeight: 716, textEnlarged: false })).toEqual({
      scale: 1,
      contentWidth: 417,
      overflows: false,
    });
    expect(widths).toEqual([417]);
  });

  it('tient pour contenu un dépassement de 0,5 px au plus (tolérance de mesure)', () => {
    expect(
      computeFit(() => 700.5, { width: 400, availableHeight: 700, textEnlarged: false }),
    ).toEqual({
      scale: 1,
      contentWidth: 400,
      overflows: false,
    });
    const { scale } = computeFit(() => 700.6, {
      width: 400,
      availableHeight: 700,
      textEnlarged: false,
    });
    expect(scale).toBeLessThan(1);
  });

  it('réduit le Profil de desktop 1280×844 : contenu de 417 px dans 716 px de haut', () => {
    // 1280×844 : zone 788 px de haut, tuile pleine hauteur 764 px, moins 48 px de barre de titre.
    const area = 385_000;
    const frame = 60;
    const result = computeFit(wrapping(area, frame), {
      width: 417,
      availableHeight: 716,
      textEnlarged: false,
    });
    const exact = exactScale(area, frame, 417, 716);
    expect(exact).toBeGreaterThan(0.8);
    expect(exact).toBeLessThan(0.9);
    expect(result.scale).toBeLessThanOrEqual(exact);
    expect(result.scale).toBeGreaterThan(exact - 0.001);
    expect(result.contentWidth).toBeCloseTo(417 / result.scale, 9);
    expect(result.overflows).toBe(false);
    // Le contenu réduit tient bien dans la hauteur disponible.
    expect(wrapping(area, frame)(result.contentWidth) * result.scale).toBeLessThanOrEqual(716);
  });

  it('rend un S qui ne dépasse jamais le S exact, au millième près', () => {
    for (const [area, frame, available] of [
      [250_000, 40, 600],
      [300_000, 60, 650],
      [480_000, 80, 900],
      [200_000, 20, 400],
    ] as const) {
      const exact = exactScale(area, frame, 400, available);
      const { scale } = computeFit(wrapping(area, frame), {
        width: 400,
        availableHeight: available,
        textEnlarged: false,
      });
      expect(scale, `${area}/${frame}/${available}`).toBeLessThanOrEqual(exact);
      expect(scale, `${area}/${frame}/${available}`).toBeGreaterThan(exact - 0.001);
      expect(scale * FIT_PRECISION).toBeCloseTo(Math.round(scale * FIT_PRECISION), 6);
    }
  });

  it('retrouve S = 0,8 quand 0,8 est la limite exacte (le milieu du premier pas)', () => {
    // Contenu qui ne se recompose pas : hauteur constante 1000 px, donc S = disponible / 1000.
    const { scale } = computeFit(() => 1000, {
      width: 400,
      availableHeight: 800,
      textEnlarged: false,
    });
    expect(scale).toBe(0.8);
  });

  it('cherche S par dichotomie en 10 pas : une mesure à S = 1, dix pas, une vérification finale', () => {
    const { measure, widths } = recorded(() => 1000);
    computeFit(measure, { width: 400, availableHeight: 700, textEnlarged: false });
    expect(widths).toHaveLength(1 + FIT_ITERATIONS + 1);
    expect(widths[0]).toBe(400);
    // Premier pas : milieu de [0,6 ; 1] = 0,8, soit une largeur élargie de 400 / 0,8.
    expect(widths[1]).toBeCloseTo(500, 9);
    // Chaque largeur est la largeur de base divisée par un S de l'intervalle [0,6 ; 1].
    for (const width of widths) {
      expect(width).toBeGreaterThanOrEqual(400);
      expect(width).toBeLessThanOrEqual(400 / FIT_MIN_SCALE + 1e-9);
    }
  });

  it('plafonne la largeur du contenu à 820 px avant élargissement', () => {
    const { measure, widths } = recorded(() => 500);
    expect(computeFit(measure, { width: 1000, availableHeight: 900, textEnlarged: false })).toEqual(
      {
        scale: 1,
        contentWidth: 820,
        overflows: false,
      },
    );
    expect(widths).toEqual([820]);

    const reduced = computeFit(wrapping(400_000, 50), {
      width: 868,
      availableHeight: 500,
      textEnlarged: false,
    });
    const exact = exactScale(400_000, 50, 820, 500);
    expect(reduced.scale).toBeLessThanOrEqual(exact);
    expect(reduced.scale).toBeGreaterThan(exact - 0.001);
    expect(reduced.contentWidth).toBeCloseTo(820 / reduced.scale, 9);
  });

  it('s’arrête à 0,6 et le contenu défile quand même 0,6 ne suffit pas', () => {
    const result = computeFit(() => 1000, {
      width: 400,
      availableHeight: 500,
      textEnlarged: false,
    });
    expect(result).toEqual({ scale: 0.6, contentWidth: 400 / 0.6, overflows: true });
  });

  it('ne signale pas de dépassement quand 0,6 tient à la tolérance près', () => {
    // À S = 0,6 le contenu mesure 600 px : disponible 599,5 + tolérance 0,5 = 600, ça tient.
    expect(
      computeFit(() => 1000, { width: 400, availableHeight: 599.5, textEnlarged: false }),
    ).toMatchObject({ scale: 0.6, overflows: false });
    expect(
      computeFit(() => 1000, { width: 400, availableHeight: 599.4, textEnlarged: false }),
    ).toMatchObject({ scale: 0.6, overflows: true });
  });

  it('désactive la réduction quand le texte est agrandi : S = 1 et le Profil défile', () => {
    const { measure, widths } = recorded(wrapping(300_000, 60));
    expect(computeFit(measure, { width: 417, availableHeight: 716, textEnlarged: true })).toEqual({
      scale: 1,
      contentWidth: 417,
      overflows: true,
    });
    expect(widths).toEqual([417]);
  });

  it('rend S = 1 sans défilement quand le texte est agrandi mais tient', () => {
    expect(computeFit(() => 300, { width: 417, availableHeight: 716, textEnlarged: true })).toEqual(
      {
        scale: 1,
        contentWidth: 417,
        overflows: false,
      },
    );
  });
});

describe('createFitCache', () => {
  const request = { width: 417, availableHeight: 716, textEnlarged: false } as const;

  it('rend le même résultat que computeFit', () => {
    const measure = wrapping(300_000, 60);
    expect(createFitCache(measure).fit(request)).toEqual(computeFit(measure, request));
  });

  it('ne mesure qu’une fois pour un même couple (largeur, hauteur)', () => {
    const { measure, widths } = recorded(wrapping(300_000, 60));
    const cache = createFitCache(measure);
    const first = cache.fit(request);
    const calls = widths.length;
    expect(calls).toBeGreaterThan(1);
    expect(cache.fit({ ...request })).toBe(first);
    expect(widths).toHaveLength(calls);
  });

  it('distingue les largeurs et les hauteurs, sans les confondre à la concaténation', () => {
    const { measure, widths } = recorded(() => 10);
    const cache = createFitCache(measure);
    cache.fit({ width: 12, availableHeight: 345, textEnlarged: false });
    cache.fit({ width: 123, availableHeight: 45, textEnlarged: false });
    cache.fit({ width: 12, availableHeight: 346, textEnlarged: false });
    cache.fit({ width: 13, availableHeight: 345, textEnlarged: false });
    expect(widths).toEqual([12, 123, 12, 13]);
  });

  it('arrondit la hauteur disponible au pixel pour la clé', () => {
    const { measure, widths } = recorded(() => 300);
    const cache = createFitCache(measure);
    cache.fit({ width: 400, availableHeight: 500.2, textEnlarged: false });
    cache.fit({ width: 400, availableHeight: 500.4, textEnlarged: false });
    expect(widths).toHaveLength(1);
    cache.fit({ width: 400, availableHeight: 500.6, textEnlarged: false });
    expect(widths).toHaveLength(2);
  });

  it('garde à part le résultat avec texte agrandi', () => {
    const cache = createFitCache(wrapping(300_000, 60));
    const normal = cache.fit(request);
    const enlarged = cache.fit({ ...request, textEnlarged: true });
    expect(normal.scale).toBeLessThan(1);
    expect(enlarged).toEqual({ scale: 1, contentWidth: 417, overflows: true });
    expect(cache.fit(request)).toBe(normal);
  });

  it('recalcule tout après invalidate (le contenu a changé)', () => {
    let content = 600;
    const { measure, widths } = recorded(() => content);
    const cache = createFitCache(measure);
    expect(cache.fit(request).scale).toBe(1);
    content = 1000;
    expect(cache.fit(request).scale).toBe(1);
    expect(widths).toHaveLength(1);

    cache.invalidate();
    const after = cache.fit(request);
    expect(after.scale).toBeLessThan(1);
    expect(after.scale).toBeGreaterThan(0.7);
  });
});
