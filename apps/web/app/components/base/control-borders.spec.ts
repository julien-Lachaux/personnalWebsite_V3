/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

// Bordures des éléments de base (décision D12) : la bordure qui identifie un contrôle (WCAG 2.2,
// 1.4.11) prend le token `--line-control` (ou `--border-control`), qui atteint 3:1 dans chaque
// palette (control-tokens.spec.ts) ; une bordure décorative ou d'un élément non interactif garde
// `--line` du handoff. Lu dans les styles livrés des composants.

const baseDir = import.meta.dirname;

/** Styles d'un composant : bloc <style> d'un `.vue`, ou fichier CSS partagé (`button.css`). */
function styleOf(file: string): string {
  const source = readFileSync(join(baseDir, file), 'utf8');
  if (file.endsWith('.css')) return source;
  const block = /<style scoped>([\s\S]*?)<\/style>/.exec(source);
  if (block?.[1] === undefined) throw new Error(`aucun bloc <style scoped> dans ${file}`);
  return block[1];
}

/** Valeur de `property` dans la règle de premier niveau dont le sélecteur est exactement `selector`. */
function declaration(file: string, selector: string, property: string): string {
  let value: string | undefined;
  postcss.parse(styleOf(file)).each((node) => {
    if (node.type !== 'rule' || node.selector !== selector) return;
    node.walkDecls(property, (found) => {
      value = found.value;
    });
  });
  if (value === undefined) throw new Error(`${property} absent de ${selector} (${file})`);
  return value;
}

/** Contrôles dont la bordure les identifie : piste, contour de puce, segment, bouton, panneau superposé. */
const CONTROLS = [
  { file: 'TechChip.vue', selector: '.tech-chip', property: 'border' },
  { file: 'Switch.vue', selector: '.switch__track', property: 'border' },
  { file: 'SegmentedControl.vue', selector: '.segmented__option', property: 'border' },
  { file: 'button.css', selector: '.base-button--secondary', property: 'border-color' },
  { file: 'Popover.vue', selector: '.popover__panel', property: 'border' },
] as const;

describe('bordures des contrôles (D12)', () => {
  it('lit la déclaration d’une règle, et signale une règle ou une propriété absente (témoin)', () => {
    expect(declaration('Switch.vue', '.switch__knob', 'border-radius')).toBe('50%');
    expect(() => declaration('Switch.vue', '.absente', 'border')).toThrow('absent de .absente');
    expect(() => declaration('Switch.vue', '.switch__knob', 'border')).toThrow('border absent');
  });

  for (const { file, selector, property } of CONTROLS) {
    it(`${selector} (${file}) : bordure par le token des contrôles`, () => {
      expect(declaration(file, selector, property)).toMatch(/^var\(--(border|line)-control\)$/);
    });
  }

  it('la puce pointillé, non interactive, garde la bordure décorative du handoff', () => {
    expect(declaration('TechChip.vue', '.tech-chip--dashed', 'border-color')).toBe('var(--line)');
  });

  it('les séparateurs des barres de titre restent décoratifs (`--line` du handoff)', () => {
    expect(declaration('Window.vue', '.window__bar', 'border-bottom')).toBe('var(--border-strong)');
    expect(declaration('Popover.vue', '.popover__bar', 'border-bottom')).toBe(
      'var(--border-strong)',
    );
  });
});
