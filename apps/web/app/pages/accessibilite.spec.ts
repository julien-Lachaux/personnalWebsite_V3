import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import DeclarationPage from './accessibilite.vue';

// Déclaration d'accessibilité provisoire (F3a, contenu en F7) : une page réelle derrière le lien du
// panneau d'accessibilité, dans les deux langues.

async function flushHead(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('déclaration d’accessibilité (provisoire)', () => {
  it('en français : titre, mention provisoire, retour à l’accueil, cible du lien d’évitement', async () => {
    const wrapper = await mountSuspended(DeclarationPage, { route: '/accessibilite' });
    await flushHead();

    expect(wrapper.get('main').attributes('id')).toBe('contenu');
    expect(wrapper.get('h1').text()).toBe('Déclaration d’accessibilité');
    expect(wrapper.text()).toContain('sera publiée après l’audit du site');
    expect(wrapper.get('a').attributes('href')).toBe('/');
    expect(wrapper.get('a').text()).toBe('Retour à l’accueil');
    expect(document.title).toBe('Déclaration d’accessibilité');
  });

  it('en anglais sous /en/accessibilite', async () => {
    const wrapper = await mountSuspended(DeclarationPage, { route: '/en/accessibilite' });

    expect(wrapper.get('h1').text()).toBe('Accessibility statement');
    expect(wrapper.get('a').attributes('href')).toBe('/en');
  });
});
