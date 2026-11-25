import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import AnnexLayout from './annex.vue';

// Gabarit annexe sans contrôles (lot 30) : une page servie sans JavaScript (page d'erreur serveur) ne
// garde que le lien du site vers l'accueil ; par défaut, les contrôles sont là.

async function mount(route: string, props: { controls?: boolean } = {}) {
  return mountSuspended(AnnexLayout, {
    route,
    props,
    slots: { default: () => h('main', { id: 'contenu' }, 'Contenu') },
  });
}

describe('gabarit annex : contrôles de l’en-tête', () => {
  it('les porte par défaut', async () => {
    const wrapper = await mount('/accessibilite');

    expect(wrapper.find('header .header-controls').exists()).toBe(true);
  });

  it('les retire avec `controls` faux, en gardant le lien vers l’accueil et le contenu', async () => {
    const wrapper = await mount('/en/50x.html', { controls: false });

    const header = wrapper.get('header');
    expect(header.find('.header-controls').exists()).toBe(false);
    expect(header.findAll('button')).toHaveLength(0);
    expect(header.findAll('a').map((link) => link.attributes('href'))).toEqual(['/en']);
    expect(header.get('a').text().replace(/\s+/g, ' ')).toBe('>_ julien-lachaux (home page)');
    expect(wrapper.get('main').text()).toBe('Contenu');
  });
});
