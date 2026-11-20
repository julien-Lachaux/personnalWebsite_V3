import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import LanguageSwitch from './LanguageSwitch.vue';

// D19 : le sélecteur affiche la langue courante (« FR » sur la page française), son nom accessible
// annonce l'action dans la langue de la page ; le lien porte `lang` et `hreflang` de la cible.

describe('LanguageSwitch (D19)', () => {
  it('sur la page française : affiche FR, se nomme « Passer en anglais », mène à /en', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/' });

    const link = wrapper.get('a');
    expect(link.attributes()).toMatchObject({ href: '/en', lang: 'en', hreflang: 'en' });
    expect(link.get('[aria-hidden="true"]').text()).toBe('FR');
    const name = link.get('.visually-hidden');
    expect(name.text()).toBe('Passer en anglais');
    expect(name.attributes('lang')).toBe('fr');
  });

  it('sur la page anglaise : affiche EN, se nomme « Switch to French », mène à /', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/en' });

    const link = wrapper.get('a');
    expect(link.attributes()).toMatchObject({ href: '/', lang: 'fr', hreflang: 'fr' });
    expect(link.get('[aria-hidden="true"]').text()).toBe('EN');
    const name = link.get('.visually-hidden');
    expect(name.text()).toBe('Switch to French');
    expect(name.attributes('lang')).toBe('en');
  });
});
