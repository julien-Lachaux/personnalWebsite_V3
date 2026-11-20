import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import LanguageSwitch from './LanguageSwitch.vue';

// D19 : le sélecteur affiche le code de la langue COURANTE et son nom accessible annonce l'action.

describe('LanguageSwitch', () => {
  it('propose l’anglais depuis le français : lien vers la même page sous /en', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/' });

    const link = wrapper.get('a');
    expect(link.attributes()).toMatchObject({ href: '/en', lang: 'en', hreflang: 'en' });
  });

  it('propose le français depuis l’anglais : lien vers la même page sans préfixe', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/en' });

    const link = wrapper.get('a');
    expect(link.attributes()).toMatchObject({ href: '/', lang: 'fr', hreflang: 'fr' });
  });

  it('affiche le code de la langue courante, masqué aux lecteurs d’écran', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/' });

    expect(wrapper.get('a [aria-hidden="true"]').text()).toBe('FR');
  });

  it('affiche EN sur la page anglaise', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/en' });

    expect(wrapper.get('a [aria-hidden="true"]').text()).toBe('EN');
  });

  it('se nomme « Passer en anglais » depuis le français, dans la langue de la page', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/' });

    const name = wrapper.get('a .visually-hidden');
    expect(name.text()).toBe('Passer en anglais');
    expect(name.attributes('lang')).toBe('fr');
  });

  it('se nomme « Switch to French » depuis l’anglais, dans la langue de la page', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/en' });

    const name = wrapper.get('a .visually-hidden');
    expect(name.text()).toBe('Switch to French');
    expect(name.attributes('lang')).toBe('en');
  });
});
