import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import LanguageSwitch from './LanguageSwitch.vue';

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

  it('affiche le code de la langue cible, masqué aux lecteurs d’écran', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/' });

    expect(wrapper.get('a [aria-hidden="true"]').text()).toBe('EN');
  });

  it('affiche FR sur la page anglaise', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/en' });

    expect(wrapper.get('a [aria-hidden="true"]').text()).toBe('FR');
  });

  it('se nomme « English » depuis le français', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/' });

    expect(wrapper.get('a .visually-hidden').text()).toBe('English');
  });

  it('se nomme « Français » depuis l’anglais', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/en' });

    expect(wrapper.get('a .visually-hidden').text()).toBe('Français');
  });

  it('a un nom accessible qui contient le code visible (étiquette dans le nom, WCAG 2.5.3)', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/' });

    const visible = wrapper.get('a [aria-hidden="true"]').text().toLowerCase();
    expect(wrapper.get('a .visually-hidden').text().toLowerCase()).toContain(visible);
  });
});
