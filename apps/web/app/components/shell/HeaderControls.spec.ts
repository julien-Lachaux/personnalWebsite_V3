import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import HeaderControls from './HeaderControls.vue';

const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

describe('HeaderControls', () => {
  it('range accessibilité, langue et thème, dans cet ordre', async () => {
    const wrapper = await mountSuspended(HeaderControls, {
      route: '/',
      props: { declarationUrl: '/accessibilite' },
    });

    const accessibility = wrapper.get('button[aria-haspopup="dialog"]').element;
    const language = wrapper.get('a[hreflang]').element;
    const theme = wrapper.get('button[aria-label^="Thème"]').element;
    expect(accessibility.compareDocumentPosition(language) & FOLLOWING).toBeTruthy();
    expect(language.compareDocumentPosition(theme) & FOLLOWING).toBeTruthy();
    expect(accessibility.getAttribute('aria-label')).toBe('Options d’accessibilité');
    expect(language.getAttribute('hreflang')).toBe('en');
    expect(theme.getAttribute('aria-label')).toBe('Thème sombre, passer en thème clair');
  });

  it('transmet l’adresse de la déclaration au panneau', async () => {
    const wrapper = await mountSuspended(HeaderControls, {
      route: '/',
      props: { declarationUrl: '/accessibilite' },
    });

    expect(wrapper.get('a.a11y-panel__link').attributes('href')).toBe('/accessibilite');
  });
});
