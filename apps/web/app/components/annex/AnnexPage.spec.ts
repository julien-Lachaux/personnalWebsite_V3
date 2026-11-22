import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import AnnexPage from './AnnexPage.vue';

// Corps des pages annexes (F7) : <main id="contenu">, retour à l'accueil de la langue en tête, puis la
// fenêtre `>_ fichier` qui porte le contenu.

async function mount(route: string) {
  return mountSuspended(AnnexPage, {
    route,
    props: { file: 'exemple.md', back: 'Retour' },
    slots: { default: () => h('h1', 'Titre') },
  });
}

describe('AnnexPage', () => {
  it('est le contenu principal, cible du lien d’évitement, focalisable par programme seulement', async () => {
    const wrapper = await mount('/accessibilite');

    const main = wrapper.get('main');
    expect(main.attributes('id')).toBe('contenu');
    expect(main.attributes('tabindex')).toBe('-1');
  });

  it('commence par le lien de retour à l’accueil de la langue de la page', async () => {
    const fr = await mount('/accessibilite');
    const first = fr.get('main').find('a');
    expect(first.text()).toBe('Retour');
    expect(first.attributes('href')).toBe('/');

    const en = await mount('/en/accessibility');
    expect(en.get('main a').attributes('href')).toBe('/en');
  });

  it('affiche le nom de fichier en barre de titre (invite décorative), puis le contenu', async () => {
    const wrapper = await mount('/accessibilite');

    const bar = wrapper.get('.annex-page__bar');
    expect(bar.text()).toBe('>_ exemple.md');
    expect(bar.get('.annex-page__prompt').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('.annex-page__body h1').text()).toBe('Titre');
    const position = bar.element.compareDocumentPosition(wrapper.get('h1').element);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
