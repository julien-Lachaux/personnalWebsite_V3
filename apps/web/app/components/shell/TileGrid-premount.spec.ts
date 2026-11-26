/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import postcss, { type AtRule, type Rule } from 'postcss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';

import { BREAKPOINTS, computeLayout, TILE_ORDER } from '../../domain/layout.js';
import type { Rect, TileId, Zone } from '../../domain/layout-types.js';
import TileGrid from './TileGrid.vue';

// Mosaïque avant le montage (D49, F11-02) : la CSS de `TileGrid` dessine la vue d'ensemble avant que
// `computeLayout` ne place les tuiles ; le montage ne doit rien déplacer. Garde-fou côté Vitest : les
// règles de la page générée (grille, requêtes média) sont lues dans le bloc <style> livré, évaluées
// pour un balayage de zones (pistes de la grille, `round()`, `max()`, pourcentages), et chaque
// rectangle obtenu est comparé à celui de `computeLayout`. Le repli sans `round()` reste à moins d'un
// demi-pixel. Le parcours `test/hydration-shift.e2e.ts` refait la comparaison dans le navigateur.

const PREMOUNT = '.tile-grid:not(.tile-grid--placed)';

const style = (() => {
  const source = readFileSync(join(import.meta.dirname, 'TileGrid.vue'), 'utf8');
  const block = /<style scoped>([\s\S]*?)<\/style>/.exec(source);
  if (block?.[1] === undefined) throw new Error('aucun bloc <style scoped> dans TileGrid.vue');
  return postcss.parse(block[1]);
})();

/** Vrai si la requête média `params` (min-width / max-width en px, jointes par `and`) vaut à `width`. */
function mediaMatches(params: string, width: number): boolean {
  const parts = params.split(' and ');
  return parts.every((part) => {
    const found = /^\((min|max)-width: (\d+)px\)$/.exec(part.trim());
    if (found === null) throw new Error(`requête média non lue : ${params}`);
    const limit = Number(found[2]);
    return found[1] === 'min' ? width >= limit : width <= limit;
  });
}

/**
 * Déclarations des règles dont la liste de sélecteurs contient `selector` et qui s'appliquent à la largeur `width`, dans l'ordre de la feuille :
 * `pick` choisit, pour une propriété déclarée plusieurs fois, la dernière (celle du navigateur) ou la
 * première (le repli).
 */
function declarations(
  selector: string,
  width: number,
  pick: 'last' | 'first' = 'last',
): Record<string, string> {
  const result: Record<string, string> = {};
  style.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return;
    const parent = rule.parent;
    if (parent?.type === 'atrule' && !mediaMatches((parent as AtRule).params, width)) return;
    const seen = new Set<string>();
    rule.walkDecls((declaration) => {
      if (pick === 'first' && seen.has(declaration.prop)) return;
      seen.add(declaration.prop);
      result[declaration.prop] = declaration.value;
    });
  });
  return result;
}

/** Morceaux de premier niveau d'une valeur séparés par des espaces (hors parenthèses). */
function topLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value.trim()) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (/\s/.test(char) && depth === 0) {
      if (current !== '') parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current !== '') parts.push(current);
  return parts;
}

/**
 * Valeur en px d'une expression CSS : nombres en px ou en %, `+ - * /`, parenthèses, `calc()`,
 * `max()`, `min()`, `round(a, b)` (au plus proche, à égalité vers +∞, comme `Math.round`).
 */
function evaluate(expression: string, percentBase: number): number {
  const tokens = expression.match(/\d+(?:\.\d+)?(?:px|%)?|[a-z]+|[()+\-*/,]/g) ?? [];
  let index = 0;
  const peek = (): string | undefined => tokens[index];
  const next = (): string => {
    const token = tokens[index++];
    if (token === undefined) throw new Error(`expression incomplète : ${expression}`);
    return token;
  };
  const consume = (token: string): void => {
    if (next() !== token) throw new Error(`« ${token} » attendu dans ${expression}`);
  };
  const sum = (): number => {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      value = next() === '+' ? value + product() : value - product();
    }
    return value;
  };
  const product = (): number => {
    let value = factor();
    while (peek() === '*' || peek() === '/') {
      value = next() === '*' ? value * factor() : value / factor();
    }
    return value;
  };
  const args = (): number[] => {
    consume('(');
    const values = [sum()];
    while (peek() === ',') {
      next();
      values.push(sum());
    }
    consume(')');
    return values;
  };
  const factor = (): number => {
    const token = next();
    if (token === '(') {
      const value = sum();
      consume(')');
      return value;
    }
    if (token === '-') return -factor();
    if (token === 'calc') return args()[0]!;
    if (token === 'max') return Math.max(...args());
    if (token === 'min') return Math.min(...args());
    if (token === 'round') {
      const [value, step] = args();
      return Math.round(value! / step!) * step!;
    }
    if (token.endsWith('%')) return (Number.parseFloat(token) * percentBase) / 100;
    if (/^\d/.test(token)) return Number.parseFloat(token);
    throw new Error(`jeton non lu « ${token} » dans ${expression}`);
  };
  const value = sum();
  if (index !== tokens.length) throw new Error(`fin inattendue de ${expression}`);
  return value;
}

/** Tailles des pistes d'une grille (`Npx`, expressions, `Nfr`) dans une place de `size` px. */
function tracks(template: string, size: number, gap: number): number[] {
  const parts = topLevel(template);
  const fixed = parts.map((part) => (part.endsWith('fr') ? null : evaluate(part, size)));
  const fractions = parts.map((part) => (part.endsWith('fr') ? Number.parseFloat(part) : 0));
  const free =
    size -
    gap * (parts.length - 1) -
    fixed.reduce<number>((total, value) => total + (value ?? 0), 0);
  const totalFr = fractions.reduce((total, value) => total + value, 0);
  return fixed.map((value, i) => value ?? (free * fractions[i]!) / totalFr);
}

/** Début et longueur des pistes `[start, end)` (lignes de grille numérotées depuis 1). */
function span(sizes: number[], gap: number, start: number, end: number): [number, number] {
  const before = sizes.slice(0, start - 1).reduce((total, value) => total + value + gap, 0);
  const inside = sizes.slice(start - 1, end - 1).reduce((total, value) => total + value, 0);
  return [before, inside + gap * (end - start - 1)];
}

/** Rectangles des tuiles que la CSS de la page générée dessine dans `zone`, ou `null` (pas de grille). */
function cssRects(zone: Zone, pick: 'last' | 'first' = 'last'): Record<TileId, Rect> | null {
  const grid = declarations(PREMOUNT, zone.width, pick);
  if (grid['display'] !== 'grid') return null;
  const gap = evaluate(grid['gap']!, zone.width);
  const padding = evaluate(grid['padding']!, zone.width);
  const inline = topLevel(grid['padding-inline'] ?? `${padding}px`);
  const left = evaluate(inline[0]!, zone.width);
  const right = evaluate(inline[1] ?? inline[0]!, zone.width);
  const columns = tracks(grid['grid-template-columns']!, zone.width - left - right, gap);
  const rows = tracks(grid['grid-template-rows']!, zone.height - 2 * padding, gap);
  const rects = {} as Record<TileId, Rect>;
  for (const id of TILE_ORDER) {
    const area = declarations(`${PREMOUNT} [data-tile='${id}']`, zone.width, pick)['grid-area'];
    if (area === undefined) throw new Error(`grid-area absente pour ${id} à ${zone.width} px`);
    const [rowStart, columnStart, rowEnd, columnEnd] = area.split('/').map(Number) as [
      number,
      number,
      number,
      number,
    ];
    const [x, width] = span(columns, gap, columnStart, columnEnd);
    const [y, height] = span(rows, gap, rowStart, rowEnd);
    rects[id] = { x: left + x, y: padding + y, width, height };
  }
  return rects;
}

/** Vue d'ensemble de `computeLayout`, hauteurs de contenu inconnues (Profil sur toute la hauteur). */
function layoutRects(zone: Zone): Record<TileId, Rect> {
  const layout = computeLayout({ zone, expanded: null, contentHeight: () => undefined });
  if (layout.mode !== 'mosaic') throw new Error(`mosaïque attendue à ${zone.width} px`);
  return Object.fromEntries(TILE_ORDER.map((id) => [id, layout.tiles[id].rect])) as Record<
    TileId,
    Rect
  >;
}

const WIDTHS = [1024, 1025, 1100, 1199, 1200, 1201, 1280, 1439, 1440, 1441, 1555, 1920, 2561, 3440];
const HEIGHTS = [401, 555, 712, 788, 1001, 1384];

describe('TileGrid avant le montage : CSS de la page générée et computeLayout (D49)', () => {
  it('évaluateur : pourcentages, round(), max(), pistes en fr (témoins)', () => {
    expect(evaluate('round((100% - 12px) * 0.5, 1px)', 25)).toBe(7);
    expect(evaluate('round((100% - 12px) * 0.5, 1px)', 24)).toBe(6);
    expect(evaluate('calc(max(0px, 100% - 30px) + 12px)', 20)).toBe(12);
    expect(tracks('10px 1fr 3fr', 114, 2)).toEqual([10, 25, 75]);
    expect(() => evaluate('clamp(1px, 2px, 3px)', 0)).toThrow('jeton non lu');
    expect(mediaMatches('(min-width: 1024px) and (max-width: 1199px)', 1199)).toBe(true);
    expect(mediaMatches('(min-width: 1024px) and (max-width: 1199px)', 1200)).toBe(false);
  });

  for (const width of WIDTHS) {
    it(`${width} px : chaque tuile à la place que computeLayout lui donne`, () => {
      for (const height of HEIGHTS) {
        const zone = { width, height };
        const expected = layoutRects(zone);
        const actual = cssRects(zone)!;
        const fallback = cssRects(zone, 'first')!;
        for (const id of TILE_ORDER) {
          for (const key of ['x', 'y', 'width', 'height'] as const) {
            const label = `${id} ${key} à ${width} × ${height}`;
            expect(actual[id][key], label).toBeCloseTo(expected[id][key], 9);
            expect(Math.abs(fallback[id][key] - expected[id][key]), `repli, ${label}`).toBeLessThan(
              0.51,
            );
          }
        }
      }
    });
  }

  it('sous 1024 px, aucune grille : la page générée montre l’onglet Profil', () => {
    expect(cssRects({ width: BREAKPOINTS.portable - 1, height: 800 })).toBeNull();
    const others = ".tile-grid .tile-grid__tile:not([data-tile='profile'])";
    expect(declarations(others, BREAKPOINTS.portable - 1)['display']).toBe('none');
    expect(declarations(others, BREAKPOINTS.portable)['display']).toBeUndefined();
    expect(declarations('.tile-grid', BREAKPOINTS.portable - 1)).toMatchObject({
      position: 'static',
    });
    expect(declarations('.tile-grid', BREAKPOINTS.portable)).toMatchObject({
      position: 'absolute',
    });
  });

  it('3 colonnes : le Profil s’arrête à la hauteur de son contenu, toute la hauteur au plus (SPEC § 4.1)', () => {
    const profile = `${PREMOUNT} [data-tile='profile']`;
    expect(declarations(profile, BREAKPOINTS.desktop)).toMatchObject({
      'align-self': 'start',
      'max-height': '100%',
    });
    expect(declarations(profile, BREAKPOINTS.desktop - 1)['align-self']).toBeUndefined();
  });
});

describe('TileGrid : classe `--placed`', () => {
  let zone: Zone = { width: 0, height: 0 };
  const mounted: VueWrapper[] = [];

  beforeEach(() => {
    zone = { width: 0, height: 0 };
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = (): undefined => undefined;
        disconnect = (): undefined => undefined;
      },
    );
    vi.stubGlobal(
      'MutationObserver',
      class {
        observe = (): undefined => undefined;
        disconnect = (): undefined => undefined;
      },
    );
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: new Promise<void>(() => undefined) },
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('tile-grid') ? zone.width : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('tile-grid') ? zone.height : 0;
    });
  });

  afterEach(() => {
    for (const wrapper of mounted.splice(0)) wrapper.unmount();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function mountGrid(): Promise<VueWrapper> {
    const wrapper = await mountSuspended(TileGrid, {
      props: { expanded: null },
      attachTo: document.body,
      slots: Object.fromEntries(TILE_ORDER.map((id) => [id, () => h('p', `contenu ${id}`)])),
    });
    mounted.push(wrapper);
    await nextTick();
    return wrapper;
  }

  it('zone de bureau : tuiles placées par computeLayout, la grille de la page générée s’efface', async () => {
    zone = { width: 1280, height: 788 };
    const wrapper = await mountGrid();

    expect(wrapper.get('.tile-grid').classes()).toContain('tile-grid--placed');
    expect(wrapper.get('[data-tile="experience"]').attributes('style')).toContain('left: 444px');
  });

  it('zone sous 1024 px (avant que la coquille ne passe aux onglets) : rien de placé, aucun style en ligne', async () => {
    zone = { width: 390, height: 700 };
    const wrapper = await mountGrid();

    expect(wrapper.get('.tile-grid').classes()).not.toContain('tile-grid--placed');
    for (const id of TILE_ORDER) {
      expect(wrapper.get(`[data-tile="${id}"]`).attributes('style')).toBeUndefined();
    }
  });
});
