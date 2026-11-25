/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import TechChip from './TechChip.vue';

// Coche de la puce pressée (D35, RA-7, WCAG 1.4.1) : une puce `aria-pressed="true"` porte une coche ✓
// devant son nom, en CSS (`::before`), décorative : hors du texte et du nom accessible (contenu
// alternatif vide), dans les couleurs de la puce (tokens, rien en dur), dans tous les thèmes. Le
// DOM de test ne rend pas les pseudo-éléments : les styles livrés sont lus, et le rendu vérifie que
// seule la puce pressée porte la classe qui les déclenche, sans texte ajouté. Le rendu réel est
// vérifié par `test/chip-pressed-mark.e2e.ts`.

const source = readFileSync(join(import.meta.dirname, 'TechChip.vue'), 'utf8');
const style = /<style scoped>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '';

/** Déclarations (propriété → valeurs, dans l'ordre) des règles dont un sélecteur finit par `::before`. */
function beforeRules(): { selector: string; declarations: [string, string][] }[] {
  const rules: { selector: string; declarations: [string, string][] }[] = [];
  postcss.parse(style).walkRules((rule) => {
    if (!rule.selector.includes('::before')) return;
    const declarations: [string, string][] = [];
    rule.walkDecls((declaration) => {
      declarations.push([declaration.prop, declaration.value]);
    });
    rules.push({ selector: rule.selector, declarations });
  });
  return rules;
}

describe('TechChip : coche de la puce pressée', () => {
  it('a une seule règle ::before, réservée à la puce pressée', () => {
    expect(beforeRules().map((rule) => rule.selector)).toEqual(['.tech-chip--pressed::before']);
  });

  it('écrit la coche ✓, avec un contenu alternatif vide (hors du nom accessible)', () => {
    const contents = beforeRules()[0]!.declarations.filter(([prop]) => prop === 'content');

    // Repli sans contenu alternatif d'abord, puis la forme avec alternative vide, retenue si comprise.
    expect(contents.map(([, value]) => value)).toEqual(["'✓'", "'✓' / ''"]);
  });

  it('ne pose aucune couleur en dur : la coche garde celles de la puce (tokens)', () => {
    for (const [prop, value] of beforeRules()[0]!.declarations) {
      if (/color|background|border|shadow/.test(prop)) {
        expect(value, prop).toMatch(/^var\(--[\w-]+\)$|^inherit$|^currentcolor$/i);
      }
    }
  });

  it('seule la puce pressée porte la classe ; aucun texte n’est ajouté au rendu', async () => {
    const render = (pressed: boolean | undefined) =>
      mountSuspended(TechChip, { props: { pressed }, slots: { default: () => 'Docker' } });
    const pressed = (await render(true)).get('button');
    const released = (await render(false)).get('button');
    const plain = (await render(undefined)).get('button');

    expect(pressed.classes()).toContain('tech-chip--pressed');
    expect(released.classes()).not.toContain('tech-chip--pressed');
    expect(plain.classes()).not.toContain('tech-chip--pressed');
    for (const button of [pressed, released, plain]) {
      expect(button.text()).toBe('Docker');
      expect(button.find('[aria-hidden]').exists()).toBe(false);
    }
  });
});
