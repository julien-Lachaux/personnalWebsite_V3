import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import AnnexLayout from './annex.vue';

// Gabarit des pages annexes (F7) : en-tête du site (lien vers l'accueil, accessibilité, langue, thème)
// au-dessus du contenu de la page.

async function mount(route: string) {
  return mountSuspended(AnnexLayout, {
    route,
    slots: { default: () => h('main', { id: 'contenu' }, 'Contenu') },
  });
}

describe('gabarit annex', () => {
  it('a un seul en-tête, avant le contenu de la page', async () => {
    const wrapper = await mount('/accessibilite');

    expect(wrapper.findAll('header')).toHaveLength(1);
    const header = wrapper.get('header').element;
    const main = wrapper.get('main').element;
    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(wrapper.get('main').text()).toBe('Contenu');
  });

  it('nomme le lien du site par son texte visible, suivi de sa destination (WCAG 2.5.3)', async () => {
    const fr = await mount('/accessibilite');
    const home = fr.get('header a.annex-layout__home');
    expect(home.attributes('href')).toBe('/');
    expect(home.text().replace(/\s+/g, ' ')).toBe('>_ julien-lachaux (accueil)');
    expect(home.get('.annex-layout__prompt').attributes('aria-hidden')).toBe('true');
    expect(home.get('.visually-hidden').text()).toBe('(accueil)');

    const en = await mount('/en/accessibility');
    const homeEn = en.get('header a.annex-layout__home');
    expect(homeEn.attributes('href')).toBe('/en');
    expect(homeEn.get('.visually-hidden').text()).toBe('(home page)');
  });

  it('porte les contrôles de l’en-tête, dont le panneau qui mène à la déclaration de la langue', async () => {
    const fr = await mount('/accessibilite');
    expect(fr.get('header button[aria-haspopup="dialog"]').attributes('aria-label')).toBe(
      'Options d’accessibilité',
    );
    expect(fr.get('header .language-switch a').attributes('href')).toBe('/en/accessibility');
    expect(fr.get('header a.a11y-panel__link').attributes('href')).toBe('/accessibilite');

    const en = await mount('/en/accessibility');
    expect(en.get('header .language-switch a').attributes('href')).toBe('/accessibilite');
    expect(en.get('header a.a11y-panel__link').attributes('href')).toBe('/en/accessibility');
  });
});
