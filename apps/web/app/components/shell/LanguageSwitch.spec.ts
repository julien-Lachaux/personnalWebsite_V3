import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import LanguageSwitch from './LanguageSwitch.vue';

// D21 : « FR | EN » visibles ; la langue courante n'est pas un lien (`aria-current`), l'autre est un
// lien dont le texte visible est le nom accessible (WCAG 2.5.3).

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

  it('affiche « FR | EN » dans cet ordre sur les deux pages', async () => {
    for (const route of ['/', '/en']) {
      const wrapper = await mountSuspended(LanguageSwitch, { route });

      expect(wrapper.text()).toBe('FR|EN');
    }
  });

  it('marque la langue courante par aria-current, sans lien, avec le lang de la page', async () => {
    const french = await mountSuspended(LanguageSwitch, { route: '/' });
    const frCurrent = french.get('[aria-current="true"]');
    expect(frCurrent.text()).toBe('FR');
    expect(frCurrent.element.tagName).not.toBe('A');
    expect(frCurrent.attributes('lang')).toBe('fr');

    const english = await mountSuspended(LanguageSwitch, { route: '/en' });
    const enCurrent = english.get('[aria-current="true"]');
    expect(enCurrent.text()).toBe('EN');
    expect(enCurrent.element.tagName).not.toBe('A');
    expect(enCurrent.attributes('lang')).toBe('en');
  });

  it('nomme le lien par son texte visible, sans aria-label (WCAG 2.5.3)', async () => {
    for (const [route, visible] of [
      ['/', 'EN'],
      ['/en', 'FR'],
    ] as const) {
      const link = (await mountSuspended(LanguageSwitch, { route })).get('a');

      expect(link.text()).toBe(visible);
      expect(link.attributes('aria-label')).toBeUndefined();
      expect(link.attributes('aria-labelledby')).toBeUndefined();
      expect(link.find('[aria-hidden="true"]').exists()).toBe(false);
    }
  });

  it('cache le séparateur aux lecteurs d’écran', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/' });

    const separators = wrapper.findAll('[aria-hidden="true"]');
    expect(separators).toHaveLength(1);
    expect(separators[0]?.text()).toBe('|');
  });
});
