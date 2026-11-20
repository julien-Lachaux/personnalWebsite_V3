import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import SeniorBadge from './SeniorBadge.vue';

describe('SeniorBadge', () => {
  it.each(['senior', 'Senior'])(
    'affiche le libellé fourni (%s) dans un texte, sans rôle interactif',
    async (label) => {
      const wrapper = await mountSuspended(SeniorBadge, { slots: { default: () => label } });

      const badge = wrapper.get('span');
      expect(badge.text()).toBe(label);
      expect(badge.classes()).toContain('senior-badge');
      expect(badge.attributes('role')).toBeUndefined();
      expect(badge.attributes('tabindex')).toBeUndefined();
      expect(wrapper.find('button, a').exists()).toBe(false);
    },
  );
});
