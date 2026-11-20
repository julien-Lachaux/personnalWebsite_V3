import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import MobileHeader from './MobileHeader.vue';

describe('MobileHeader', () => {
  it.each([
    ['profile', 'profil.cv'],
    ['experience', 'experience.log'],
    ['recommendations', 'recommandations.md'],
    ['ai', 'ia.md'],
  ] as const)('affiche >_ julien-lachaux/%s avec le fichier de l’onglet', async (id, file) => {
    const wrapper = await mountSuspended(MobileHeader, {
      route: '/',
      props: { active: id, declarationUrl: '/accessibilite' },
    });

    expect(wrapper.get('.mobile-header__title').text()).toBe(`>_ julien-lachaux/${file}`);
  });

  it('met le préfixe en retrait et le fichier à part, l’invite est décorative', async () => {
    const wrapper = await mountSuspended(MobileHeader, {
      route: '/',
      props: { active: 'experience', declarationUrl: '/accessibilite' },
    });

    const title = wrapper.get('.mobile-header__title');
    expect(title.get('.mobile-header__prompt').attributes('aria-hidden')).toBe('true');
    expect(title.get('.mobile-header__handle').text()).toBe('julien-lachaux/');
    const spans = title.findAll(':scope > span');
    expect(spans.at(-1)!.text()).toBe('experience.log');
    expect(spans.at(-1)!.classes()).toEqual([]);
  });

  it('est l’en-tête de la page et porte accessibilité, langue et thème', async () => {
    const wrapper = await mountSuspended(MobileHeader, {
      route: '/',
      props: { active: 'profile', declarationUrl: '/accessibilite' },
    });

    expect(wrapper.get('header').element.tagName).toBe('HEADER');
    expect(wrapper.find('button[aria-haspopup="dialog"]').exists()).toBe(true);
    expect(wrapper.find('a[hreflang="en"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label^="Thème"]').exists()).toBe(true);
    expect(wrapper.get('a.a11y-panel__link').attributes('href')).toBe('/accessibilite');
  });

  it('garde les mêmes noms de fichier en anglais', async () => {
    const wrapper = await mountSuspended(MobileHeader, {
      route: '/en',
      props: { active: 'recommendations', declarationUrl: '/en/accessibilite' },
    });

    expect(wrapper.get('.mobile-header__title').text()).toBe(
      '>_ julien-lachaux/recommandations.md',
    );
    expect(wrapper.get('button[aria-haspopup="dialog"]').attributes('aria-label')).toBe(
      'Accessibility options',
    );
  });
});
