/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

// Bordure des contrôles (décision D12) : `--line-control` atteint 3:1 (WCAG 2.2, 1.4.11) sur chaque
// fond opaque, dans chaque état de la racine (thème posé ou système, contraste renforcé), calculé
// depuis la CSS livrée (tokens.css puis control-tokens.css, dans l'ordre de nuxt.config.ts) par une
// cascade réduite aux sélecteurs de la racine. Le `--line` décoratif du handoff ne change pas : sa
// fidélité est vérifiée par tokens.spec.ts.

const cssDir = import.meta.dirname;
const FILES = ['tokens.css', 'control-tokens.css'];

/** État de <html> : attributs posés par les préférences et schéma de couleur du système. */
interface RootState {
  theme?: 'sombre' | 'clair';
  contrast?: 'renforce';
  systemDark: boolean;
}

interface Rule {
  selectors: string[];
  media: string;
  declarations: Record<string, string>;
}

function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  postcss.parse(css).walkRules((rule) => {
    const parent = rule.parent;
    const media = parent?.type === 'atrule' ? (parent as postcss.AtRule).params : '';
    const declarations: Record<string, string> = {};
    rule.walkDecls((declaration) => {
      declarations[declaration.prop] = declaration.value;
    });
    rules.push({ selectors: rule.selectors.map((s) => s.replace(/\s/g, '')), media, declarations });
  });
  return rules;
}

const MEDIA: Record<string, (state: RootState) => boolean> = {
  '': () => true,
  '(prefers-color-scheme: dark)': (state) => state.systemDark,
  // Mouvement non réduit dans ces états : seules les durées en dépendent.
  '(prefers-reduced-motion: reduce)': () => false,
  // Bureau (D51 (4)) : seules les piles de polices en dépendent, aucune couleur. Vrai, pour que
  // la règle soit appliquée à la cascade et que toute couleur qu'elle poserait soit vue.
  '(min-width: 1024px)': () => true,
};

function mediaMatches(media: string, state: RootState): boolean {
  const test = MEDIA[media];
  if (test === undefined) throw new Error(`requête média inconnue : ${media}`);
  return test(state);
}

const ATTRIBUTE = /^(:not\()?\[([\w-]+)(?:=['"]?([\w-]+)['"]?)?\]\)?/;

/** Spécificité (nombre de classes et attributs, `:root` compris) si le sélecteur s'applique, sinon null. */
function selectorMatches(selector: string, state: RootState): number | null {
  if (!selector.startsWith(':root')) throw new Error(`sélecteur hors de la racine : ${selector}`);
  const attributes: Record<string, string | undefined> = {
    'data-theme': state.theme,
    'data-contrast': state.contrast,
  };
  let rest = selector.slice(':root'.length);
  let specificity = 1;
  let matches = true;
  while (rest !== '') {
    const part = ATTRIBUTE.exec(rest);
    if (part === null) throw new Error(`sélecteur non pris en charge : ${selector}`);
    const [whole, negated, name = '', value] = part;
    const actual = attributes[name];
    const present = value === undefined ? actual !== undefined : actual === value;
    if (present === (negated !== undefined)) matches = false;
    specificity += 1;
    rest = rest.slice(whole.length);
  }
  return matches ? specificity : null;
}

const RULES = FILES.flatMap((file) => parseRules(readFileSync(join(cssDir, file), 'utf8')));

/** Variables calculées sur <html> : règles applicables triées par spécificité puis ordre source. */
function computed(state: RootState, rules: readonly Rule[] = RULES): Record<string, string> {
  const applicable = rules.flatMap((rule, order) => {
    if (!mediaMatches(rule.media, state)) return [];
    const specificities = rule.selectors
      .map((selector) => selectorMatches(selector, state))
      .filter((value): value is number => value !== null);
    return specificities.length === 0
      ? []
      : [{ rule, order, specificity: Math.max(...specificities) }];
  });
  applicable.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  const result: Record<string, string> = {};
  for (const { rule } of applicable) {
    for (const [name, value] of Object.entries(rule.declarations)) {
      if (name.startsWith('--')) result[name] = value;
    }
  }
  return result;
}

/** Valeur d'une variable, `var(--x)` résolu. */
function resolved(variables: Record<string, string>, name: string, seen: string[] = []): string {
  const value = variables[`--${name}`];
  if (value === undefined) throw new Error(`variable absente : --${name}`);
  const reference = /^var\(--([a-z-]+)\)$/.exec(value.trim());
  if (reference?.[1] === undefined) return value.trim().toLowerCase();
  if (seen.includes(reference[1])) throw new Error(`référence circulaire : --${name}`);
  return resolved(variables, reference[1], [...seen, name]);
}

function rgb(value: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1] === undefined) throw new Error(`couleur opaque attendue : ${value}`);
  const digits = hex[1];
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminance relative WCAG 2.2. */
function luminance(color: string): number {
  const [r = 0, g = 0, b = 0] = rgb(color).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG, sans arrondi. */
function contrast(a: string, b: string): number {
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Fonds opaques sur lesquels un contrôle peut se trouver (page, tuile, barre du haut, titre, champ). */
const BACKGROUNDS = ['bg', 'card', 'top', 'bar', 'field'];

const STATES: { name: string; state: RootState; dark: boolean; reinforced: boolean }[] = [
  {
    name: 'sombre posé',
    state: { theme: 'sombre', systemDark: false },
    dark: true,
    reinforced: false,
  },
  { name: 'sombre du système', state: { systemDark: true }, dark: true, reinforced: false },
  {
    name: 'clair posé',
    state: { theme: 'clair', systemDark: true },
    dark: false,
    reinforced: false,
  },
  { name: 'clair du système', state: { systemDark: false }, dark: false, reinforced: false },
  {
    name: 'sombre, contraste renforcé',
    state: { theme: 'sombre', contrast: 'renforce', systemDark: false },
    dark: true,
    reinforced: true,
  },
  {
    name: 'clair, contraste renforcé',
    state: { theme: 'clair', contrast: 'renforce', systemDark: true },
    dark: false,
    reinforced: true,
  },
  {
    // Le contraste renforcé n'agit qu'avec data-theme posé (tête de tokens.css).
    name: 'renforcé sans thème posé, système sombre',
    state: { contrast: 'renforce', systemDark: true },
    dark: true,
    reinforced: false,
  },
];

describe('cascade de la racine (témoins)', () => {
  it('applique la règle la plus spécifique, puis la dernière à spécificité égale', () => {
    const rules: Rule[] = [
      { selectors: [':root'], media: '', declarations: { '--x': '#000001' } },
      { selectors: [":root[data-theme='sombre']"], media: '', declarations: { '--x': '#000002' } },
      { selectors: [':root'], media: '', declarations: { '--x': '#000003' } },
      {
        selectors: [':root:not([data-theme])'],
        media: '(prefers-color-scheme: dark)',
        declarations: { '--x': '#000004' },
      },
    ];
    expect(computed({ theme: 'sombre', systemDark: false }, rules)['--x']).toBe('#000002');
    expect(computed({ theme: 'clair', systemDark: true }, rules)['--x']).toBe('#000003');
    expect(computed({ systemDark: true }, rules)['--x']).toBe('#000004');
    expect(computed({ systemDark: false }, rules)['--x']).toBe('#000003');
  });

  it('refuse un sélecteur ou une requête média qu’elle ne sait pas lire', () => {
    expect(() => selectorMatches('.chip', { systemDark: false })).toThrow('hors de la racine');
    expect(() => selectorMatches(':root>body', { systemDark: false })).toThrow(
      'non pris en charge',
    );
    expect(() => mediaMatches('print', { systemDark: false })).toThrow('requête média inconnue');
  });

  it('calcule les rapports connus de WCAG et résout var()', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5);
    expect(resolved({ '--a': 'var(--b)', '--b': '#ABCDEF' }, 'a')).toBe('#abcdef');
    expect(() => resolved({ '--a': 'var(--a)' }, 'a')).toThrow('référence circulaire');
  });
});

describe('bordure des contrôles (D12)', () => {
  for (const { name, state, dark, reinforced } of STATES) {
    it(`${name} : --line-control atteint 3:1 sur chaque fond opaque`, () => {
      const variables = computed(state);
      const control = resolved(variables, 'line-control');
      const failures = BACKGROUNDS.map((bg) => ({
        bg,
        value: contrast(control, resolved(variables, bg)),
      }))
        .filter(({ value }) => value < 3)
        .map(({ bg, value }) => `${control} sur ${bg} : ${value.toFixed(2)}`);
      expect(failures).toEqual([]);

      if (dark && !reinforced) {
        expect(control).toBe('#66798a');
      } else {
        // Les autres palettes passent déjà 3:1 avec la bordure du handoff : elle est reprise telle quelle.
        expect(control).toBe(resolved(variables, 'line'));
      }
      expect(resolved(variables, 'border-control')).toBe(
        `var(--border-width) solid var(--line-control)`,
      );
    });
  }

  it('le --line décoratif du handoff reste inchangé en sombre, et n’atteint pas 3:1 (raison de D12)', () => {
    const variables = computed({ theme: 'sombre', systemDark: false });
    expect(resolved(variables, 'line')).toBe('#3a4b57');
    expect(contrast(resolved(variables, 'line'), resolved(variables, 'bg'))).toBeLessThan(3);
  });
});
