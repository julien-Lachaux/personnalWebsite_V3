/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

// Tokens ajoutés au lot F5c à la demande des sections (comptes rendus F5a et F5b) : taille du titre
// d'une tuile du bureau (titre de l'IA, 22 px) et durées de l'easter egg (350 ms par ligne, 1,4 s pour
// la barre), réduites à 0,01 ms sous mouvement réduit comme toutes les durées. Les composants les
// utilisent à la place de leurs anciennes valeurs locales.

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

function source(path: string): string {
  return readFileSync(join(appDir, path), 'utf8');
}

describe('taille du titre d’une tuile', () => {
  it('--font-size-h3-tile vaut 22 px en rem', () => {
    expect(declarations('tokens.css')['|:root']?.['--font-size-h3-tile']).toBe('1.375rem');
  });

  it('le titre de l’IA l’utilise, sans taille écrite en dur', () => {
    const style = source('components/ai/AiSection.vue');
    expect(style).toContain('font-size: var(--font-size-h3-tile)');
    expect(style).not.toContain('1.375rem');
  });
});

describe('durées de l’easter egg', () => {
  const motion = declarations('motion.css');

  it('350 ms par ligne, 1,4 s pour la barre (maquette v6)', () => {
    expect(motion['|:root']).toMatchObject({
      '--dur-egg-line': '350ms',
      '--dur-egg-bar': '1400ms',
    });
  });

  it('0,01 ms sous mouvement réduit (réglage, ou système sauf data-motion="normal")', () => {
    const reduced = { '--dur-egg-line': '0.01ms', '--dur-egg-bar': '0.01ms' };
    expect(motion["|:root[data-motion='reduit']"]).toMatchObject(reduced);
    expect(
      motion["(prefers-reduced-motion: reduce)|:root:not([data-motion='normal'])"],
    ).toMatchObject(reduced);
  });

  it('la fenêtre les utilise, sans durée locale', () => {
    const style = source('components/experience/EasterEggWindow.vue');
    expect(style).toContain('animation: egg-line var(--dur-egg-line)');
    expect(style).toContain('animation: egg-bar var(--dur-egg-bar)');
    expect(style).not.toMatch(/\d+ms/);
  });
});
