import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearNuxtData, useRuntimeConfig } from '#imports';

import IndexPage from './index.vue';

// Page d'accueil (lot F3a) : la vraie page remplace la page provisoire. On vérifie ici ce que
// la page provisoire garantissait encore : un seul `h1`, et la version de l'autre langue offerte
// par un lien `lang`/`hreflang` (le sélecteur de langue de la coquille, D19).

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

describe("page d'accueil", () => {
  it('affiche un seul h1 et propose la version anglaise depuis le français (D21)', async () => {
    const wrapper = await mountSuspended(IndexPage, { route: '/' });

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.get('h1').text()).toBe('Développeur full-stack');
    const links = wrapper.findAll('a[hreflang]');
    expect(links).toHaveLength(1);
    expect(links[0]?.attributes()).toMatchObject({ href: '/en', lang: 'en', hreflang: 'en' });
    expect(links[0]?.text()).toBe('EN');
  });

  it('propose la version française depuis l’anglais', async () => {
    const wrapper = await mountSuspended(IndexPage, { route: '/en' });

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.get('h1').text()).toBe('Full-stack developer');
    const links = wrapper.findAll('a[hreflang]');
    expect(links).toHaveLength(1);
    expect(links[0]?.attributes()).toMatchObject({ href: '/', lang: 'fr', hreflang: 'fr' });
    expect(links[0]?.text()).toBe('FR');
  });
});
