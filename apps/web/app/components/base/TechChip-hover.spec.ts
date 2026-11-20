/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import TechChip from './TechChip.vue';

// Survol néon de la puce (F1-03, suite F1 bis) : réservé aux puces interactives. La règle de survol
// des styles livrés est appliquée aux éléments tels que le composant les rend (sans `:hover`, que le
// DOM de test ne simule pas) : elle vise la puce cliquable, ni la puce inactive ni la puce pointillé.

const source = readFileSync(join(import.meta.dirname, 'TechChip.vue'), 'utf8');
const style = /<style scoped>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '';

/** Sélecteurs des règles `:hover` des styles livrés, `:hover` retiré. */
function hoverSelectors(): string[] {
  const selectors: string[] = [];
  postcss.parse(style).walkRules((rule) => {
    if (rule.selector.includes(':hover')) selectors.push(rule.selector.replace(/:hover/g, ''));
  });
  return selectors;
}

async function chip(props: {
  pressed?: boolean;
  disabled?: boolean;
  dashed?: boolean;
}): Promise<Element> {
  const wrapper = await mountSuspended(TechChip, { props, slots: { default: () => 'Vue.js' } });
  return wrapper.get('.tech-chip').element;
}

describe('TechChip : survol', () => {
  it('a une seule règle de survol', () => {
    expect(hoverSelectors()).toHaveLength(1);
  });

  it('s’applique à la puce cliquable, pressée ou non', async () => {
    const [selector = ''] = hoverSelectors();

    expect((await chip({})).matches(selector)).toBe(true);
    expect((await chip({ pressed: true })).matches(selector)).toBe(true);
  });

  it('ne s’applique ni à la puce pointillé (non interactive) ni à la puce inactive', async () => {
    const [selector = ''] = hoverSelectors();
    const dashed = await chip({ dashed: true });

    expect(dashed.tagName).toBe('SPAN');
    expect(dashed.matches(selector)).toBe(false);
    expect((await chip({ disabled: true })).matches(selector)).toBe(false);
  });
});
