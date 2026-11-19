import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import IndexPage from './index.vue';

describe("page d'accueil provisoire", () => {
  it('affiche un seul h1 et propose la version anglaise depuis le français', async () => {
    const wrapper = await mountSuspended(IndexPage, { route: '/' });

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('h1').text()).toBe('Site en construction');
    const link = wrapper.get('a');
    expect(link.attributes()).toMatchObject({ href: '/en', lang: 'en', hreflang: 'en' });
    expect(link.text()).toBe('Read in English');
  });

  it('propose la version française depuis l’anglais', async () => {
    const wrapper = await mountSuspended(IndexPage, { route: '/en' });

    expect(wrapper.find('h1').text()).toBe('Website under construction');
    const link = wrapper.get('a');
    expect(link.attributes()).toMatchObject({ href: '/', lang: 'fr', hreflang: 'fr' });
    expect(link.text()).toBe('Lire en français');
  });
});
