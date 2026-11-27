/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import postcss, { type AtRule, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

import { BREAKPOINTS } from '../../domain/layout.js';

// Piles de polices du bureau (docs/05, D51 (4), lot F11) : à partir du seuil de la mosaïque, une
// seule règle `@media (min-width: 1024px) { :root { … } }` de tokens.css place les faces de repli
// ajustées de fonts.css entre la police du handoff et sa famille générique. Ce test reconstruit la
// pile attendue depuis le handoff (`design/handoff-v6/tokens.css`) et les faces de fonts.css (une
// face de repli de « X » se nomme « X Fallback… », dans l'ordre du fichier), puis exige exactement
// cette pile, pour la sans et la mono, et rien d'autre dans la règle. La déclaration de base de
// `:root`, sous 1024 px, reste celle du handoff : tokens.spec.ts le vérifie.

const cssDir = import.meta.dirname;
const handoffDir = resolve(cssDir, '../../../design/handoff-v6');
const DESKTOP_QUERY = `(min-width: ${BREAKPOINTS.portable}px)`;
const VARIABLES = ['--font-sans', '--font-mono'] as const;

/** Familles d'une pile CSS, guillemets retirés, dans l'ordre. */
function families(stack: string): string[] {
  return stack.split(',').map((family) => family.trim().replace(/^(['"])(.*)\1$/, '$2'));
}

/** Déclarations de la règle `:root` hors requête média du handoff. */
function handoffRoot(): Record<string, string> {
  const declarations: Record<string, string> = {};
  postcss.parse(readFileSync(join(handoffDir, 'tokens.css'), 'utf8')).each((node) => {
    if (node.type === 'rule' && node.selector === ':root') {
      node.walkDecls((declaration) => {
        declarations[declaration.prop] = declaration.value;
      });
    }
  });
  return declarations;
}

/** Familles des `@font-face` de fonts.css, dans l'ordre du fichier, sans doublon. */
function fontFaceFamilies(): string[] {
  const found: string[] = [];
  postcss
    .parse(readFileSync(join(cssDir, 'fonts.css'), 'utf8'))
    .walkAtRules('font-face', (face) => {
      face.walkDecls('font-family', (declaration) => {
        const [family = ''] = families(declaration.value);
        if (!found.includes(family)) found.push(family);
      });
    });
  return found;
}

/** Règles `@media` de tokens.css pour le bureau. */
function desktopRules(): AtRule[] {
  const rules: AtRule[] = [];
  postcss.parse(readFileSync(join(cssDir, 'tokens.css'), 'utf8')).walkAtRules('media', (media) => {
    if (media.params === DESKTOP_QUERY) rules.push(media);
  });
  return rules;
}

describe('piles de polices du bureau (tokens.css, D51 (4))', () => {
  const handoff = handoffRoot();
  const faces = fontFaceFamilies();

  it('une seule règle du bureau, qui ne contient que `:root`', () => {
    const rules = desktopRules();
    expect(rules).toHaveLength(1);
    const children = rules[0]?.nodes ?? [];
    expect(children.map((node) => node.type)).toEqual(['rule']);
    expect((children[0] as Rule).selector).toBe(':root');
  });

  it('elle ne porte que --font-sans et --font-mono', () => {
    const root = desktopRules()[0]?.nodes?.[0] as Rule;
    const props: string[] = [];
    root.each((node) => {
      props.push(node.type === 'decl' ? node.prop : node.type);
    });
    expect(props).toEqual([...VARIABLES]);
  });

  it.each(VARIABLES)(
    '%s = police du handoff, replis de fonts.css, famille générique du handoff',
    (variable) => {
      const base = families(handoff[variable] ?? '');
      expect(base).toHaveLength(2);
      const [primary = '', generic = ''] = base;
      const fallbacks = faces.filter((family) => family.startsWith(`${primary} Fallback`));
      expect(fallbacks.length).toBeGreaterThan(0);

      const root = desktopRules()[0]?.nodes?.[0] as Rule;
      let value = '';
      root.walkDecls(variable, (declaration) => {
        value = declaration.value;
      });
      expect(families(value)).toEqual([primary, ...fallbacks, generic]);
    },
  );
});
