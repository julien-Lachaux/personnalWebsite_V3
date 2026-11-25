import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtState, useRouter } from '#imports';

import App from './app.vue';
import { UNINDEXED_PATH_STATE_KEY } from './composables/seo/useSeo.js';

// Racine et page hors index (lot 31) : sur la page « travaux en cours », app.vue garde `lang` mais ne
// pose ni canonique, ni hreflang, ni `og:url`, ni `og:locale` (la page n'entre pas dans le plan du
// site) ; une page indexée retrouve ces liens après une navigation.

const mounted: VueWrapper[] = [];

beforeEach(() => {
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
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  clearNuxtState(UNINDEXED_PATH_STATE_KEY);
  vi.restoreAllMocks();
});

async function flushHead(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function mountApp(route: string): Promise<VueWrapper> {
  const wrapper = await mountSuspended(App, { route });
  mounted.push(wrapper);
  await flushHead();
  return wrapper;
}

function head() {
  const meta = (selector: string): string | null =>
    document.head.querySelector(`meta[${selector}]`)?.getAttribute('content') ?? null;
  return {
    lang: document.documentElement.getAttribute('lang'),
    robots: meta('name="robots"'),
    ogUrl: meta('property="og:url"'),
    ogLocale: meta('property="og:locale"'),
    canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    alternates: document.head.querySelectorAll('link[rel="alternate"][hreflang]').length,
  };
}

describe('app.vue : page hors index', () => {
  for (const { route, lang, title } of [
    { route: '/travaux', lang: 'fr', title: 'Site en cours de construction' },
    { route: '/en/work-in-progress', lang: 'en', title: 'Site under construction' },
  ]) {
    it(`${route} : lang="${lang}", noindex, ni canonique ni hreflang ni og:url`, async () => {
      const wrapper = await mountApp(route);

      expect(wrapper.get('h1').text()).toBe(title);
      expect(wrapper.find('a').classes()).toContain('skip-link');
      expect(head()).toEqual({
        lang,
        robots: 'noindex',
        ogUrl: null,
        ogLocale: null,
        canonical: null,
        alternates: 0,
      });
    });
  }

  it('une page indexée retrouve canonique et hreflang après la page hors index', async () => {
    const wrapper = await mountApp('/travaux');
    expect(head().canonical).toBeNull();

    await useRouter().push('/accessibilite');
    await vi.waitFor(() => {
      expect(wrapper.get('h1').text()).toBe('Déclaration d’accessibilité');
    });

    // Route de la racine et en-tête mis à jour après la fin de la navigation (asynchrones).
    await vi.waitFor(() => {
      expect(head()).toMatchObject({
        robots: null,
        canonical: 'http://localhost:3001/accessibilite',
        ogUrl: 'http://localhost:3001/accessibilite',
        alternates: 3,
      });
    });
  });
});
