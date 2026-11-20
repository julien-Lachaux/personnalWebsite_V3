/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

// Design tokens (ticket F1-01) : fidélité au handoff v6 et contrastes WCAG 2.2 AA calculés depuis la
// CSS livrée, dans les quatre palettes (sombre, clair, et leur contraste renforcé).
// - Les couleurs et constantes de `tokens.css` sont celles de `design/handoff-v6/` à l'identique :
//   une valeur du handoff qui échoue à un contraste ne se corrige pas ici (sortie honorable).
// - Chaque couple texte/fond des rôles du handoff atteint 4,5:1 (1.4.3) ; chaque indicateur
//   d'interface (contour de focus, état actif) atteint 3:1 sur les fonds où il apparaît (1.4.11).
//   Les bordures `line` et séparateurs `hair` ne sont pas dans cette liste : voir le compte rendu du
//   lot F1a (point ouvert, contrastes mesurés), la décision revient à l'orchestrateur.

const cssDir = import.meta.dirname;
const appDir = resolve(cssDir, '../..');
const handoffDir = resolve(appDir, '../design/handoff-v6');

type Block = Record<string, string>;

/** Déclarations de chaque règle, par « requête média | sélecteur » (sélecteur sans espaces ni guillemets). */
function blocks(css: string): Map<string, Block> {
  const result = new Map<string, Block>();
  postcss.parse(css).walkRules((rule) => {
    const media = rule.parent?.type === 'atrule' ? (rule.parent as { params: string }).params : '';
    const key = `${media}|${rule.selector.replace(/[\s'"]/g, '')}`;
    const declarations: Block = {};
    rule.walkDecls((declaration) => {
      declarations[declaration.prop] = declaration.value;
    });
    result.set(key, { ...result.get(key), ...declarations });
  });
  return result;
}

function block(map: Map<string, Block>, key: string): Block {
  const found = map.get(key);
  if (found === undefined) throw new Error(`règle absente : ${key}`);
  return found;
}

const tokens = blocks(readFileSync(join(cssDir, 'tokens.css'), 'utf8'));
const handoffCss = blocks(readFileSync(join(handoffDir, 'tokens.css'), 'utf8'));
const handoff = JSON.parse(readFileSync(join(handoffDir, 'design-tokens.json'), 'utf8')) as {
  color: { themes: Record<Theme, Block>; highContrast: Record<Theme, Block> };
  font: { size: Record<string, string>; weight: Record<string, number> };
  motion: Record<string, { duration?: string; easing?: string; distance?: string }>;
  radius: Record<string, string>;
  space: Record<string, string>;
  size: Record<string, string>;
};

type Theme = 'sombre' | 'clair';

const ROOT = '|:root';
const CLAIR = '|:root:not([data-theme]),:root[data-theme=clair]';
const SOMBRE = '|:root[data-theme=sombre]';
const SOMBRE_SYSTEM = '(prefers-color-scheme: dark)|:root:not([data-theme])';
const CONTRAST: Record<Theme, string> = {
  sombre: '|:root[data-theme=sombre][data-contrast=renforce]',
  clair: '|:root[data-theme=clair][data-contrast=renforce]',
};

/** Variables seules (sans `color-scheme`), pour comparer une palette à celle du handoff. */
function customProperties(source: Block): Block {
  return Object.fromEntries(Object.entries(source).filter(([name]) => name.startsWith('--')));
}

function palette(theme: Theme, contrast: boolean): Block {
  const base = customProperties(block(tokens, theme === 'sombre' ? SOMBRE : CLAIR));
  return contrast ? { ...base, ...customProperties(block(tokens, CONTRAST[theme])) } : base;
}

// --- Couleurs et comparaison de valeurs -----------------------------------------------------------

type Rgba = readonly [number, number, number, number];

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
  if (hex?.[1] !== undefined) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    const [r, g, b, a] = [0, 2, 4, 6].map((i) => parseInt(digits.slice(i, i + 2) || 'ff', 16));
    return [r ?? 0, g ?? 0, b ?? 0, (a ?? 255) / 255];
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
  if (fn?.[1] !== undefined) {
    const [r = NaN, g = NaN, b = NaN, a = 1] = fn[1].split(',').map((part) => Number(part.trim()));
    if ([r, g, b, a].every(Number.isFinite)) return [r, g, b, a];
  }
  throw new Error(`couleur illisible : ${value}`);
}

/** Écriture canonique d'une valeur CSS : couleurs en rgba, nombres réécrits, espaces et guillemets normalisés. */
function canonical(value: string): string {
  return value
    .replace(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi, (color) => `rgba(${parseColor(color).join(',')})`)
    .replace(/-?\d*\.?\d+/g, (number) => String(Number(number)))
    .replace(/"/g, "'")
    .replace(/\s*([,()])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function canonicalBlock(source: Block): Block {
  return Object.fromEntries(
    Object.entries(source).map(([name, value]) => [name, canonical(value)]),
  );
}

/** Couleur d'une variable de la palette, `var(--x)` résolu. */
function colorOf(source: Block, name: string, seen: readonly string[] = []): Rgba {
  const value = source[`--${name}`];
  if (value === undefined) throw new Error(`variable absente : --${name}`);
  const reference = /^var\(--([a-z-]+)\)$/.exec(value.trim());
  if (reference?.[1] !== undefined) {
    if (seen.includes(reference[1])) throw new Error(`référence circulaire : --${name}`);
    return colorOf(source, reference[1], [...seen, name]);
  }
  return parseColor(value);
}

/** Couleur `top` posée sur un fond opaque `bottom` (composition alpha en sRGB). */
function over(top: Rgba, bottom: Rgba): Rgba {
  const [r, g, b] = [0, 1, 2].map((i) => (top[i] ?? 0) * top[3] + (bottom[i] ?? 0) * (1 - top[3]));
  return [r ?? 0, g ?? 0, b ?? 0, 1];
}

/** Luminance relative WCAG 2.2 (seuil sRGB 0,04045). */
function luminance([r, g, b]: Rgba): number {
  const [lr = 0, lg = 0, lb = 0] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** Rapport de contraste WCAG, sans arrondi (4,499 échoue à 4,5). */
function contrast(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** Texte `fg` sur le fond `bg` ; un fond translucide est posé sur le fond opaque `under`. */
interface Couple {
  fg: string;
  bg: string;
  under?: string;
}

function ratio(source: Block, { fg, bg, under }: Couple): number {
  const background =
    under === undefined ? colorOf(source, bg) : over(colorOf(source, bg), colorOf(source, under));
  return contrast(over(colorOf(source, fg), background), background);
}

/** Couples sous le seuil, avec leur rapport, pour un message d'échec lisible. */
function below(source: Block, couples: readonly Couple[], threshold: number): string[] {
  return couples
    .map((couple) => ({ couple, value: ratio(source, couple) }))
    .filter(({ value }) => value < threshold)
    .map(
      ({ couple: { fg, bg, under }, value }) =>
        `${fg} sur ${bg}${under === undefined ? '' : ` (sur ${under})`} : ${value.toFixed(2)}`,
    );
}

// --- Couples des rôles du handoff (design-tokens.json, `color.roles`) -----------------------------

/** Fonds opaques : page, tuiles et fenêtres, barre du haut, barres de titre, champs. */
const BACKGROUNDS = ['bg', 'card', 'top', 'bar', 'field'];
/** Couleurs de texte : principal, secondaire, liens et actions, méta, néon, LinkedIn. */
const TEXT_COLORS = ['text', 'muted', 'accent', 'violet', 'neon', 'li'];

const TEXT_COUPLES: readonly Couple[] = [
  ...TEXT_COLORS.flatMap((fg) => BACKGROUNDS.map((bg) => ({ fg, bg }))),
  { fg: 'on', bg: 'accent' }, // boutons pleins, lien d'évitement, taille du texte choisie
  { fg: 'sen-fg', bg: 'sen-bg', under: 'card' }, // pastille senior
  { fg: 'neon', bg: 'neon-bg', under: 'card' }, // filtres actifs, puces au survol
  { fg: 'text', bg: 'neon-bg', under: 'card' },
  { fg: 'accent', bg: 'accent-bg', under: 'top' }, // onglet actif
  { fg: 'accent', bg: 'accent-bg', under: 'card' },
  { fg: 'text', bg: 'accent-bg', under: 'top' },
  { fg: 'violet', bg: 'violet-bg', under: 'card' },
  { fg: 'li', bg: 'li-bg', under: 'card' }, // bouton « Voir sur LinkedIn »
];

/** Indicateurs d'interface : contour de focus et état actif (accent), bordures néon et LinkedIn. */
const INTERFACE_COUPLES: readonly Couple[] = [
  ...BACKGROUNDS.map((bg) => ({ fg: 'accent', bg })),
  { fg: 'neon', bg: 'card' },
  { fg: 'li', bg: 'card' },
];

const PALETTES = [
  { name: 'sombre', theme: 'sombre', contrast: false },
  { name: 'clair', theme: 'clair', contrast: false },
  { name: 'sombre, contraste renforcé', theme: 'sombre', contrast: true },
  { name: 'clair, contraste renforcé', theme: 'clair', contrast: true },
] as const;

describe('calcul des contrastes (témoins)', () => {
  it('donne les rapports connus de WCAG', () => {
    expect(contrast(parseColor('#000000'), parseColor('#ffffff'))).toBeCloseTo(21, 10);
    expect(contrast(parseColor('#fff'), parseColor('#fff'))).toBe(1);
    // #767676 est le gris le plus clair qui passe 4,5:1 sur blanc, #777777 échoue de peu.
    expect(contrast(parseColor('#767676'), parseColor('#ffffff'))).toBeCloseTo(4.54, 2);
    expect(contrast(parseColor('#777777'), parseColor('#ffffff'))).toBeLessThan(4.5);
  });

  it('compose une couleur translucide sur son fond', () => {
    expect(over(parseColor('rgba(0, 0, 0, 0.5)'), parseColor('#ffffff'))).toEqual([
      127.5, 127.5, 127.5, 1,
    ]);
    expect(parseColor('#1f5c4d1a')).toEqual([31, 92, 77, 26 / 255]);
  });

  it('signale un couple sous le seuil et résout les références var()', () => {
    const sample = { '--a': '#777777', '--b': '#ffffff', '--c': 'var(--a)', '--d': 'var(--d)' };

    expect(below(sample, [{ fg: 'c', bg: 'b' }], 4.5)).toEqual(['c sur b : 4.48']);
    expect(below(sample, [{ fg: 'a', bg: 'b' }], 3)).toEqual([]);
    expect(() => colorOf(sample, 'd')).toThrow('référence circulaire');
    expect(() => colorOf(sample, 'e')).toThrow('variable absente');
    expect(() => parseColor('bleu')).toThrow('couleur illisible');
  });

  it('écrit une valeur sous une forme canonique', () => {
    expect(canonical('rgba(31,92,77,0.10)')).toBe(canonical('rgba(31, 92, 77, .1)'));
    expect(canonical('4px 4px 0 #1F5C4D')).toBe('4px 4px 0 rgba(31,92,77,1)');
    expect(canonical('rgba(31,92,77,0.10)')).not.toBe(canonical('rgba(31,92,77,0.12)'));
    expect(canonical('cubic-bezier(.4,0,.15,1)')).toBe('cubic-bezier(0.4,0,0.15,1)');
    expect(canonical('"Space Grotesk", sans-serif')).toBe("'space grotesk',sans-serif");
    expect(canonical('0 0 14px var(--neon-glow),inset 0 0 8px var(--neon-in)')).toBe(
      canonical('0 0 14px var(--neon-glow), inset 0 0 8px var(--neon-in)'),
    );
  });
});

describe('tokens.css reprend le handoff v6 à l’identique', () => {
  /** Rôles du JSON (`bg`, `text`…) en noms de variables (`--bg`, `--text`…). */
  const asVariables = (roles: Block): Block =>
    Object.fromEntries(Object.entries(roles).map(([role, value]) => [`--${role}`, value]));

  for (const theme of ['sombre', 'clair'] as const) {
    it(`palette ${theme}`, () => {
      expect(canonicalBlock(palette(theme, false))).toEqual(
        canonicalBlock(asVariables(handoff.color.themes[theme])),
      );
    });

    it(`contraste renforcé ${theme}`, () => {
      expect(canonicalBlock(customProperties(block(tokens, CONTRAST[theme])))).toEqual(
        canonicalBlock(asVariables(handoff.color.highContrast[theme])),
      );
    });
  }

  it('le repli sur le thème du système (sans data-theme) copie exactement le thème sombre', () => {
    expect(block(tokens, SOMBRE_SYSTEM)).toEqual(block(tokens, SOMBRE));
    expect(block(tokens, SOMBRE)['color-scheme']).toBe('dark');
    expect(block(tokens, CLAIR)['color-scheme']).toBe('light');
  });

  it('constantes de tokens.css du handoff (polices, rayons, largeurs, mouvement)', () => {
    const root = canonicalBlock(block(tokens, ROOT));
    for (const [name, value] of Object.entries(block(handoffCss, ROOT))) {
      expect(root[name], name).toBe(canonical(value));
    }
  });

  it('tailles du texte du handoff converties en rem (1rem = 16 px)', () => {
    const root = block(tokens, ROOT);
    const names: Record<string, string> = {
      meta: 'meta',
      small: 'small',
      body: 'body',
      bodyMobile: 'body-mobile',
      lead: 'lead',
      leadMobile: 'lead-mobile',
      h2Section: 'h2-section',
      h1Desktop: 'h1-desktop',
      h1Portable: 'h1-portable',
      h1Mobile: 'h1-mobile',
      h1Tablet: 'h1-tablet',
    };
    expect(Object.keys(names).sort()).toEqual(Object.keys(handoff.font.size).sort());
    for (const [key, px] of Object.entries(handoff.font.size)) {
      expect(root[`--font-size-${names[key] ?? key}`], key).toBe(`${parseFloat(px) / 16}rem`);
    }
    for (const [key, weight] of Object.entries(handoff.font.weight)) {
      expect(root[`--font-weight-${key}`], key).toBe(String(weight));
    }
  });

  it('rayons, espacements, tailles et animations du handoff', () => {
    const root = canonicalBlock(block(tokens, ROOT));
    const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const expected: Block = {
      ...Object.fromEntries(Object.entries(handoff.radius).map(([k, v]) => [`--radius-${k}`, v])),
      ...Object.fromEntries(Object.entries(handoff.space).map(([k, v]) => [`--${kebab(k)}`, v])),
      ...Object.fromEntries(Object.entries(handoff.size).map(([k, v]) => [`--${kebab(k)}`, v])),
      '--dur-tile': handoff.motion['tile']?.duration ?? '',
      '--dur-accordion': handoff.motion['accordion']?.duration ?? '',
      '--dur-drawer': handoff.motion['drawer']?.duration ?? '',
      '--dur-cta-bar': handoff.motion['ctaBar']?.duration ?? '',
      '--dur-press': handoff.motion['press']?.duration ?? '',
      '--ease-tile': handoff.motion['tile']?.easing ?? '',
      '--ease-ui': handoff.motion['accordion']?.easing ?? '',
      '--ease-press': handoff.motion['press']?.easing ?? '',
      '--slide-distance': handoff.motion['slide']?.distance ?? '',
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(root[name], name).toBe(canonical(value));
    }
    // Les trois courbes d'interface du handoff (accordéon, tiroir, barre d'actions) n'en font qu'une.
    expect(
      new Set(['accordion', 'drawer', 'ctaBar'].map((k) => handoff.motion[k]?.easing)),
    ).toEqual(new Set([handoff.motion['accordion']?.easing]));
  });
});

describe('réglages d’accessibilité des tokens', () => {
  const durations = Object.keys(block(tokens, ROOT)).filter((name) => name.startsWith('--dur-'));

  it('le mouvement réduit (réglage ou système) ramène chaque durée à 0,01 ms', () => {
    expect(durations.length).toBeGreaterThanOrEqual(5);
    const reduced = Object.fromEntries(durations.map((name) => [name, '0.01ms']));
    expect(block(tokens, '|:root[data-motion=reduit]')).toEqual(reduced);
    expect(
      block(tokens, '(prefers-reduced-motion: reduce)|:root:not([data-motion=normal])'),
    ).toEqual(reduced);
  });

  it('la taille du texte agit sur le facteur de la taille racine (100, 115, 130 %)', () => {
    expect(block(tokens, ROOT)['--text-scale']).toBe('1');
    expect(block(tokens, '|:root[data-text-size=115]')).toEqual({ '--text-scale': '1.15' });
    expect(block(tokens, '|:root[data-text-size=130]')).toEqual({ '--text-scale': '1.3' });
  });

  it('la police plus lisible remplace les deux familles par Atkinson Hyperlegible', () => {
    expect(block(tokens, '|:root[data-font=lisible]')).toEqual({
      '--font-sans': 'var(--font-readable)',
      '--font-mono': 'var(--font-readable)',
    });
    expect(block(tokens, ROOT)['--font-readable']).toContain('Atkinson Hyperlegible');
  });
});

describe('contrastes WCAG 2.2 AA des palettes', () => {
  for (const { name, theme, contrast: reinforced } of PALETTES) {
    it(`${name} : texte ≥ 4,5:1, indicateurs d’interface ≥ 3:1`, () => {
      const source = palette(theme, reinforced);
      expect(below(source, TEXT_COUPLES, 4.5)).toEqual([]);
      expect(below(source, INTERFACE_COUPLES, 3)).toEqual([]);
    });
  }
});

describe('tailles de texte', () => {
  /** Fichiers de style d'`app/` : CSS et blocs <style> des composants. */
  function styleSources(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return styleSources(path);
      return /\.(css|vue)$/.test(entry.name) ? [path] : [];
    });
  }

  const PX_FONT_SIZE = /(?:font-size|font)\s*:[^;{}]*\d(?:\.\d+)?px/g;

  it('repère une taille de texte en px', () => {
    expect('a { font-size: 14px }'.match(PX_FONT_SIZE)).toHaveLength(1);
    expect('a { font: 700 1.5px/2 x }'.match(PX_FONT_SIZE)).toHaveLength(1);
    expect('a { font-size: 1rem; padding: 4px }'.match(PX_FONT_SIZE)).toBeNull();
  });

  it('aucune taille de texte en px dans les styles d’app/ (tout en rem)', () => {
    const offenders = styleSources(appDir).flatMap((file) =>
      (readFileSync(file, 'utf8').match(PX_FONT_SIZE) ?? []).map(
        (match) => `${relative(appDir, file)} : ${match}`,
      ),
    );
    expect(offenders).toEqual([]);
    expect(block(tokens, '|:root')['--font-size-body']).toMatch(/rem$/);
  });
});
