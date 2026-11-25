import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRuntimeConfig } from '#imports';

import CvButton from './CvButton.vue';

// Version absente (D44, qui remplace le repli de D22) : la liste des CV présents est posée par chaque
// test (configuration publique de l'application de test), pour ne pas dépendre de public/cv/.
let original: string[] = [];

beforeEach(() => {
  original = useRuntimeConfig().public.cvFiles;
});

afterEach(() => {
  useRuntimeConfig().public.cvFiles = original;
});

describe('CvButton, version dont le fichier manque (D44)', () => {
  it('sans CV anglais : l’entrée anglaise reste affichée, inactive, « (bientôt) »', async () => {
    useRuntimeConfig().public.cvFiles = ['cv-fr.pdf'];

    const wrapper = await mountSuspended(CvButton, {
      route: '/',
      props: { href: '/cv/cv-fr.pdf' },
    });

    const [french, english] = wrapper.findAll('li a');
    expect(french!.attributes('href')).toBe('/cv/cv-fr.pdf');
    expect(french!.text()).toBe('Version française');
    expect(english!.text()).toBe('Version anglaise (bientôt)');
    expect(english!.attributes('aria-disabled')).toBe('true');
    for (const name of ['href', 'download', 'hreflang', 'type']) {
      expect(english!.attributes(), name).not.toHaveProperty(name);
    }
    expect(french!.attributes()).not.toHaveProperty('aria-disabled');
  });

  it('même mention en anglais : « (coming soon) »', async () => {
    useRuntimeConfig().public.cvFiles = ['cv-fr.pdf'];

    const wrapper = await mountSuspended(CvButton, {
      route: '/en',
      props: { href: '/cv/cv-en.pdf' },
    });

    expect(wrapper.findAll('li a').map((link) => link.text())).toEqual([
      'French version',
      'English version (coming soon)',
    ]);
  });

  it('avec les deux CV : deux liens, aucune entrée inactive', async () => {
    useRuntimeConfig().public.cvFiles = ['cv-en.pdf', 'cv-fr.pdf'];

    const wrapper = await mountSuspended(CvButton, {
      route: '/en',
      props: { href: '/cv/cv-en.pdf' },
    });

    expect(wrapper.findAll('li a[aria-disabled]')).toHaveLength(0);
    expect(wrapper.findAll('li a[href]')).toHaveLength(2);
  });

  it('une version inactive ne contient plus que le texte : pas de lien activable', async () => {
    useRuntimeConfig().public.cvFiles = [];

    const wrapper = await mountSuspended(CvButton, {
      route: '/',
      props: { href: '/cv/cv-fr.pdf' },
    });

    expect(wrapper.findAll('li a[aria-disabled="true"]')).toHaveLength(2);
    expect(wrapper.findAll('li a[href]')).toHaveLength(0);
  });
});
