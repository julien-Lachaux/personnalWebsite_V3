import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import LanguageSwitch from './LanguageSwitch.vue';

// D43 : les deux libellés de « FR | EN » occupent la même boîte (le séparateur ne bouge pas au
// changement de langue) et la langue courante prend la couleur d'accent. Le contraste de `--accent`
// sur les fonds des barres (`--top`, `--bar`, `--bg`) est vérifié dans les quatre palettes par
// `assets/css/tokens.spec.ts` (≥ 4,5:1).

const source = readFileSync(join(import.meta.dirname, 'LanguageSwitch.vue'), 'utf8');

/** Corps de la règle CSS d'un sélecteur dans le bloc <style> propre au composant. */
function rule(selector: string, from = 0): string {
  const start = source.indexOf(`${selector} {`, from);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf('}', start));
}

describe('LanguageSwitch (D43)', () => {
  it('garde la même structure, séparateur au milieu, dans les deux langues', async () => {
    for (const route of ['/', '/en']) {
      const wrapper = await mountSuspended(LanguageSwitch, { route });
      const children = wrapper.findAll('.language-switch > *');

      expect(children).toHaveLength(3);
      expect(children[1]?.attributes('aria-hidden')).toBe('true');
      expect(children[1]?.text()).toBe('|');
    }
  });

  it('donne à la langue courante la boîte du lien : 40 px, 44 px sous 1024 px', () => {
    const current = rule('.language-switch__current');
    expect(current).toContain('width: var(--desktop-control)');
    expect(current).toContain('height: var(--desktop-control)');
    expect(current).toContain('justify-content: center');

    const touch = rule('.language-switch__current', source.indexOf('@media (max-width: 1023px)'));
    expect(touch).toContain('width: var(--touch-target)');
    expect(touch).toContain('height: var(--touch-target)');
  });

  it('colore la langue courante en accent', () => {
    expect(rule('.language-switch__current')).toContain('color: var(--accent)');
  });
});
