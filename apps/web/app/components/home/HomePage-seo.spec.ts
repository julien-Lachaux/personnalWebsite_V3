import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtData, useRuntimeConfig } from '#imports';

import { MOSAIC_QUERY } from '../../composables/shell/useShellMode.js';
import HomePage from './HomePage.vue';

// Titre et description de la page d'accueil (lot F11, RC-5 de la revue F10) : construits depuis la vue
// du CV (nom du titulaire et intitulé du profil), jamais depuis un nom écrit dans les libellés. Les
// fixtures nomment le titulaire « Prénom Nom », absent de tout libellé : le retrouver dans la
// description prouve qu'il vient du CV.

// Adresse de test : un placeholder, jamais une vraie adresse (SPEC § 11).
const PLACEHOLDER = 'contact@example.org';

interface Saved {
  contactEmail: string;
  cvSource: string;
  apiBaseUrl: string;
}

let saved: Saved;
const mounted: VueWrapper[] = [];

async function mountPage(route: string): Promise<void> {
  mounted.push(await mountSuspended(HomePage, { route, attachTo: document.body }));
  // unhead reporte l'en-tête dans le document de façon asynchrone.
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function meta(selector: string): string | null {
  return document.head.querySelector(`meta[${selector}]`)?.getAttribute('content') ?? null;
}

beforeEach(() => {
  const config = useRuntimeConfig();
  saved = {
    contactEmail: config.public.contactEmail,
    cvSource: config.cvSource,
    apiBaseUrl: config.apiBaseUrl,
  };
  config.public.contactEmail = PLACEHOLDER;
  config.cvSource = 'fixtures';
  config.apiBaseUrl = '';
  clearNuxtData();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === MOSAIC_QUERY,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  const config = useRuntimeConfig();
  config.public.contactEmail = saved.contactEmail;
  config.cvSource = saved.cvSource;
  config.apiBaseUrl = saved.apiBaseUrl;
  clearNuxtData();
  vi.restoreAllMocks();
});

describe('référencement de la page d’accueil', () => {
  it('en français : titre « nom · intitulé », description au nom et à l’intitulé du CV', async () => {
    await mountPage('/');

    expect(document.title).toBe('Prénom Nom · Développeur full-stack');
    const description =
      'Site et CV de Prénom Nom, développeur full-stack : expériences, technologies, recommandations et place de l’IA dans son travail.';
    expect(meta('name="description"')).toBe(description);
    expect(meta('property="og:description"')).toBe(description);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  });

  it('en anglais', async () => {
    await mountPage('/en');

    expect(document.title).toBe('Prénom Nom · Full-stack developer');
    const description =
      'Website and CV of Prénom Nom, full-stack developer: experience, technologies, recommendations and the place of AI in his work.';
    expect(meta('name="description"')).toBe(description);
    expect(meta('property="og:description"')).toBe(description);
  });
});
