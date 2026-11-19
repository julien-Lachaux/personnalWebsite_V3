import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import App from './app.vue';

/** Attend que unhead ait reporté l'en-tête dans le document (mise à jour asynchrone). */
async function flushHead(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function alternates(): Record<string, string | null> {
  const links = [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')];
  return Object.fromEntries(
    links.map((link): [string, string | null] => [
      link.getAttribute('hreflang') ?? '',
      link.getAttribute('href'),
    ]),
  );
}

describe('app.vue (langue et hreflang)', () => {
  it('sert la page française sans préfixe avec lang="fr" et les liens hreflang des deux langues', async () => {
    const wrapper = await mountSuspended(App, { route: '/' });
    await flushHead();

    expect(wrapper.find('h1').text()).toBe('Site en construction');
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(alternates()).toMatchObject({
      fr: 'http://localhost:3001',
      en: 'http://localhost:3001/en',
      'x-default': 'http://localhost:3001',
    });
  });

  it('sert la page anglaise sous /en avec lang="en"', async () => {
    const wrapper = await mountSuspended(App, { route: '/en' });
    await flushHead();

    expect(wrapper.find('h1').text()).toBe('Website under construction');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'http://localhost:3001/en',
    );
  });
});
