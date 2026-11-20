import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import LanguageSwitch from './LanguageSwitch.vue';

// D21 (remplace D19) : sur chaque page, la langue courante est un texte (`aria-current`) et l'autre
// langue est le seul lien, dont le nom accessible est exactement le texte visible.

describe('LanguageSwitch (D21)', () => {
  it('sur la page française : FR courant, lien « EN » vers /en', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/' });

    expect(wrapper.findAll('a')).toHaveLength(1);
    const link = wrapper.get('a');
    expect(link.attributes()).toMatchObject({ href: '/en', lang: 'en', hreflang: 'en' });
    expect(link.text()).toBe('EN');
    expect(wrapper.get('[aria-current="true"]').text()).toBe('FR');
  });

  it('sur la page anglaise : EN courant, lien « FR » vers /', async () => {
    const wrapper = await mountSuspended(LanguageSwitch, { route: '/en' });

    expect(wrapper.findAll('a')).toHaveLength(1);
    const link = wrapper.get('a');
    expect(link.attributes()).toMatchObject({ href: '/', lang: 'fr', hreflang: 'fr' });
    expect(link.text()).toBe('FR');
    expect(wrapper.get('[aria-current="true"]').text()).toBe('EN');
  });
});
