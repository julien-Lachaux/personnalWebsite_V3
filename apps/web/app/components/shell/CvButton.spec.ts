import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import CvButton from './CvButton.vue';

describe('CvButton', () => {
  it('est un lien téléchargeable vers le CV reçu, nommé « CV PDF »', async () => {
    const wrapper = await mountSuspended(CvButton, {
      route: '/',
      props: { href: '/cv/exemple.pdf' },
    });

    const link = wrapper.get('a');
    expect(link.attributes('href')).toBe('/cv/exemple.pdf');
    expect(link.attributes()).toHaveProperty('download');
    expect(link.text()).toBe('CV PDF');
  });

  it('garde « CV PDF » en anglais', async () => {
    const wrapper = await mountSuspended(CvButton, {
      route: '/en',
      props: { href: '/cv/exemple.pdf' },
    });

    expect(wrapper.get('a').text()).toBe('CV PDF');
  });

  it('porte l’icône de téléchargement du handoff, décorative', async () => {
    const wrapper = await mountSuspended(CvButton, {
      route: '/',
      props: { href: '/cv/exemple.pdf' },
    });

    const icon = wrapper.get('a .base-button__icon');
    expect(icon.attributes('aria-hidden')).toBe('true');
    expect(icon.get('svg path').attributes('d')).toBe('M12 4v11M7 11l5 5 5-5M5 20h14');
  });

  it('est un bouton contour de 40 px par défaut, de la taille demandée sinon', async () => {
    const small = await mountSuspended(CvButton, { route: '/', props: { href: '/cv.pdf' } });
    const medium = await mountSuspended(CvButton, {
      route: '/',
      props: { href: '/cv.pdf', size: 'md' },
    });

    expect(small.get('a').classes()).toEqual(
      expect.arrayContaining(['base-button--outline', 'base-button--sm']),
    );
    expect(medium.get('a').classes()).toEqual(
      expect.arrayContaining(['base-button--outline', 'base-button--md']),
    );
  });

  it('ouvre un CV hébergé ailleurs dans un nouvel onglet, sans transmettre l’opener (SPEC § 11)', async () => {
    const wrapper = await mountSuspended(CvButton, {
      route: '/',
      props: { href: 'https://example.org/cv.pdf' },
    });

    const link = wrapper.get('a');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
  });
});
