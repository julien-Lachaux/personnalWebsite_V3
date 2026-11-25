import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import AnnexPage from './AnnexPage.vue';

// Page annexe sans lien de retour (lot 31, page « travaux en cours », qui tient lieu d'accueil pendant
// les travaux) : le contenu principal commence directement par la fenêtre `>_ fichier`.

describe('AnnexPage sans `back`', () => {
  it('n’a aucun lien de retour : main contient la seule fenêtre et son contenu', async () => {
    const wrapper = await mountSuspended(AnnexPage, {
      route: '/travaux',
      props: { file: 'exemple.md' },
      slots: { default: () => h('h1', 'Titre') },
    });

    const main = wrapper.get('main');
    expect(main.attributes('id')).toBe('contenu');
    expect(main.findAll('a')).toHaveLength(0);
    expect(wrapper.find('.annex-page__back').exists()).toBe(false);
    expect(main.element.firstElementChild?.classList.contains('annex-page__window')).toBe(true);
    expect(wrapper.get('.annex-page__bar').text()).toBe('>_ exemple.md');
    expect(wrapper.get('.annex-page__body h1').text()).toBe('Titre');
  });
});
