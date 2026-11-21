import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRuntimeConfig } from '#imports';

import CvButton from './CvButton.vue';

// Repli du CV (D22) : la liste des CV présents est posée par chaque test (configuration publique de
// l'application de test), pour ne pas dépendre du contenu de public/cv/.
let original: string[] = [];

beforeEach(() => {
  original = useRuntimeConfig().public.cvFiles;
});

afterEach(() => {
  useRuntimeConfig().public.cvFiles = original;
});

describe('CvButton, repli vers le CV français (D22)', () => {
  it('sans CV anglais : lien vers le CV français, « (in French) » dans le nom, hreflang fr', async () => {
    useRuntimeConfig().public.cvFiles = ['cv-fr.pdf'];

    const wrapper = await mountSuspended(CvButton, {
      route: '/en',
      props: { href: '/cv/cv-en.pdf' },
    });

    const link = wrapper.get('a');
    expect(link.attributes()).toMatchObject({
      href: '/cv/cv-fr.pdf',
      hreflang: 'fr',
      type: 'application/pdf',
    });
    expect(link.text()).toBe('CV PDF (in French)');
  });

  it('avec le CV anglais : lien vers lui, sans mention ni hreflang', async () => {
    useRuntimeConfig().public.cvFiles = ['cv-en.pdf', 'cv-fr.pdf'];

    const wrapper = await mountSuspended(CvButton, {
      route: '/en',
      props: { href: '/cv/cv-en.pdf' },
    });

    const link = wrapper.get('a');
    expect(link.attributes('href')).toBe('/cv/cv-en.pdf');
    expect(link.attributes()).not.toHaveProperty('hreflang');
    expect(link.text()).toBe('CV PDF');
  });
});
