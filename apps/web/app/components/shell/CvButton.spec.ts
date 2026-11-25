import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRuntimeConfig } from '#imports';

import CvButton from './CvButton.vue';

// Liste des CV présents posée par chaque test, pour ne pas dépendre du contenu de public/cv/.
let original: string[] = [];

beforeEach(() => {
  original = useRuntimeConfig().public.cvFiles;
  useRuntimeConfig().public.cvFiles = ['cv-fr.pdf', 'cv-en.pdf'];
});

afterEach(() => {
  useRuntimeConfig().public.cvFiles = original;
});

describe('CvButton (menu, D44)', () => {
  it('est un bouton « CV PDF » fermé, qui commande la liste des versions', async () => {
    const wrapper = await mountSuspended(CvButton, {
      route: '/',
      props: { href: '/cv/cv-fr.pdf' },
    });

    const trigger = wrapper.get('button');
    expect(trigger.text()).toBe('CV PDF');
    expect(trigger.attributes('type')).toBe('button');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    const list = wrapper.get('ul');
    expect(trigger.attributes('aria-controls')).toBe(list.attributes('id'));
    expect(list.attributes()).toHaveProperty('hidden');
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('propose les versions française et anglaise en français, des liens PDF téléchargeables', async () => {
    const wrapper = await mountSuspended(CvButton, {
      route: '/',
      props: { href: '/cv/cv-fr.pdf' },
    });

    const links = wrapper.findAll('li a');
    expect(links.map((link) => link.text())).toEqual(['Version française', 'Version anglaise']);
    expect(links.map((link) => link.attributes('href'))).toEqual([
      '/cv/cv-fr.pdf',
      '/cv/cv-en.pdf',
    ]);
    expect(links.map((link) => link.attributes('hreflang'))).toEqual(['fr', 'en']);
    for (const link of links) {
      expect(link.attributes('type')).toBe('application/pdf');
      expect(link.attributes()).toHaveProperty('download');
    }
  });

  it('propose les mêmes versions en anglais', async () => {
    const wrapper = await mountSuspended(CvButton, {
      route: '/en',
      props: { href: '/cv/cv-en.pdf' },
    });

    expect(wrapper.get('button').text()).toBe('CV PDF');
    expect(wrapper.findAll('li a').map((link) => link.text())).toEqual([
      'French version',
      'English version',
    ]);
  });

  it('porte l’icône de téléchargement du handoff, décorative', async () => {
    const wrapper = await mountSuspended(CvButton, {
      route: '/',
      props: { href: '/cv/cv-fr.pdf' },
    });

    const icon = wrapper.get('button .base-button__icon');
    expect(icon.attributes('aria-hidden')).toBe('true');
    expect(icon.get('svg path').attributes('d')).toBe('M12 4v11M7 11l5 5 5-5M5 20h14');
  });

  it('est un bouton contour de 40 px par défaut, de la taille demandée sinon', async () => {
    const small = await mountSuspended(CvButton, { route: '/', props: { href: '/cv/cv-fr.pdf' } });
    const medium = await mountSuspended(CvButton, {
      route: '/',
      props: { href: '/cv/cv-fr.pdf', size: 'md' },
    });

    expect(small.get('button').classes()).toEqual(
      expect.arrayContaining(['base-button--outline', 'base-button--sm']),
    );
    expect(medium.get('button').classes()).toEqual(
      expect.arrayContaining(['base-button--outline', 'base-button--md']),
    );
  });

  it('s’ouvre vers le bas dans la barre du haut, vers le haut sur demande', async () => {
    const down = await mountSuspended(CvButton, { route: '/', props: { href: '/cv/cv-fr.pdf' } });
    const up = await mountSuspended(CvButton, {
      route: '/',
      props: { href: '/cv/cv-fr.pdf', placement: 'up' },
    });

    expect(down.get('.cv-menu').classes()).toContain('cv-menu--down');
    expect(up.get('.cv-menu').classes()).toContain('cv-menu--up');
  });
});
