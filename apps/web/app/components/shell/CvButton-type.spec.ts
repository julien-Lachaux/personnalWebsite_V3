import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRuntimeConfig } from '#imports';

import CvButton from './CvButton.vue';

let original: string[] = [];

beforeEach(() => {
  original = useRuntimeConfig().public.cvFiles;
  useRuntimeConfig().public.cvFiles = ['cv-fr.pdf', 'cv-en.pdf'];
});

afterEach(() => {
  useRuntimeConfig().public.cvFiles = original;
});

describe('CvButton (D22, D44)', () => {
  it('annonce un document PDF pour chaque version, dans chaque langue', async () => {
    for (const route of ['/', '/en']) {
      const wrapper = await mountSuspended(CvButton, {
        route,
        props: { href: '/cv/cv-fr.pdf' },
      });

      expect(
        wrapper.findAll('li a').map((link) => link.attributes('type')),
        route,
      ).toEqual(['application/pdf', 'application/pdf']);
      wrapper.unmount();
    }
  });
});
