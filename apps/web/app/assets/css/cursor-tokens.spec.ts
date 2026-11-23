/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

// Token ajouté au lot F6b (revue de la PR #11) : durée d'un cycle de clignotement du curseur de
// l'encart « IA » vide (1,1 s), réduite à 0,01 ms sous mouvement réduit comme toutes les durées. Le
// composant l'utilise à la place de sa valeur locale.

const cssDir = import.meta.dirname;
const appDir = join(cssDir, '..', '..');

/** Déclarations de chaque règle, par « requête média|sélecteur ». */
function declarations(file: string): Record<string, Record<string, string>> {
  const blocks: Record<string, Record<string, string>> = {};
  postcss.parse(readFileSync(join(cssDir, file), 'utf8')).walkRules((rule) => {
    const parent = rule.parent;
    const media = parent?.type === 'atrule' ? (parent as postcss.AtRule).params : '';
    const key = `${media}|${rule.selector.replace(/\s/g, '')}`;
    const block = (blocks[key] ??= {});
    rule.walkDecls((declaration) => {
      block[declaration.prop] = declaration.value;
    });
  });
  return blocks;
}

describe('durée du clignotement du curseur de l’encart IA', () => {
  const motion = declarations('motion.css');

  it('1,1 s par cycle', () => {
    expect(motion['|:root']?.['--dur-cursor-blink']).toBe('1100ms');
  });

  it('0,01 ms sous mouvement réduit (réglage, ou système sauf data-motion="normal")', () => {
    expect(motion["|:root[data-motion='reduit']"]?.['--dur-cursor-blink']).toBe('0.01ms');
    expect(
      motion["(prefers-reduced-motion: reduce)|:root:not([data-motion='normal'])"]?.[
        '--dur-cursor-blink'
      ],
    ).toBe('0.01ms');
  });

  it('le placeholder l’utilise, sans durée écrite en dur', () => {
    const component = readFileSync(join(appDir, 'components/ai/AiPlaceholder.vue'), 'utf8');
    const style = component.slice(component.indexOf('<style'));
    expect(style).toContain('animation: ai-placeholder-blink var(--dur-cursor-blink)');
    expect(style).not.toMatch(/\d(?:\.\d+)?m?s\b/);
  });
});
