import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtData, useRuntimeConfig } from '#imports';

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

// La page rendue est la vraie page d'accueil : contact et source du CV (fixtures) posés pour le test,
// `document.fonts` et `matchMedia` absents ou partiels dans le DOM de test.
let saved: { contactEmail: string; cvSource: string };

beforeEach(() => {
  const config = useRuntimeConfig();
  saved = { contactEmail: config.public.contactEmail, cvSource: config.cvSource };
  config.public.contactEmail = 'contact@example.org';
  config.cvSource = 'fixtures';
  clearNuxtData();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.spyOn(window, 'matchMedia').mockImplementation(
    () =>
      ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  const config = useRuntimeConfig();
  config.public.contactEmail = saved.contactEmail;
  config.cvSource = saved.cvSource;
  clearNuxtData();
  vi.restoreAllMocks();
});

describe('app.vue (langue et hreflang)', () => {
  it('sert la page française sans préfixe avec lang="fr" et les liens hreflang des deux langues', async () => {
    const wrapper = await mountSuspended(App, { route: '/' });
    await flushHead();

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.get('h1').text()).toBe('Développeur full-stack');
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

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.get('h1').text()).toBe('Full-stack developer');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'http://localhost:3001/en',
    );
  });
});
