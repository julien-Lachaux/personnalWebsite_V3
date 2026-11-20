import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import CvButton from './CvButton.vue';

describe('CvButton (D22)', () => {
  it('annonce un document PDF, dans chaque langue', async () => {
    for (const route of ['/', '/en']) {
      const wrapper = await mountSuspended(CvButton, {
        route,
        props: { href: '/cv/exemple.pdf' },
      });

      expect(wrapper.get('a').attributes('type'), route).toBe('application/pdf');
      wrapper.unmount();
    }
  });
});
