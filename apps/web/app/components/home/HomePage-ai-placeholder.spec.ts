import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtData, useRuntimeConfig } from '#imports';

import { cvFr } from '../../data/fixtures/cv.fr.js';
import { cvEn } from '../../data/fixtures/cv.en.js';
import { MOSAIC_QUERY } from '../../composables/shell/useShellMode.js';
import HomePage from './HomePage.vue';

// Placeholder de la section IA (D27) : quand l'API ne sert pas de section IA, la tuile (bureau) et
// l'onglet (mobile, tablette) affichent le placeholder terminal ; avec une section IA, le contenu normal.

const PLACEHOLDER = 'contact@example.org';

interface Saved {
  contactEmail: string;
  cvSource: string;
  apiBaseUrl: string;
}

let saved: Saved;
const mounted: VueWrapper[] = [];

function width(mosaic: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === MOSAIC_QUERY ? mosaic : false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

async function mountPage(route: string): Promise<VueWrapper> {
  const wrapper = await mountSuspended(HomePage, { route, attachTo: document.body });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
}

/** L'API sert le CV sans section IA (`aiOverview` nul) ; `route` choisit la langue. */
function apiWithoutAi(): void {
  registerEndpoint('http://api.placeholder.test/api/v1/cv', {
    method: 'GET',
    handler: (event) =>
      new URL(event.node.req.url ?? '', 'http://api.placeholder.test').searchParams.get('lang') ===
      'en'
        ? { ...cvEn, aiOverview: null }
        : { ...cvFr, aiOverview: null },
  });
  const config = useRuntimeConfig();
  config.cvSource = 'api';
  config.apiBaseUrl = 'http://api.placeholder.test';
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

describe('page d’accueil : placeholder de la section IA', () => {
  it('bureau, sans section IA : la tuile IA affiche le placeholder en français, pas de contenu IA', async () => {
    width(true);
    apiWithoutAi();
    const wrapper = await mountPage('/');

    const section = wrapper.get('#section-ai');
    expect(section.get('h2').text()).toBe('IA');
    expect(section.findAll('.ai-placeholder')).toHaveLength(1);
    expect(section.get('.ai-placeholder__command').text()).toBe('cat ia.md');
    expect(section.text()).toContain('ia.md : en cours d’écriture…');
    expect(section.find('.ai').exists()).toBe(false);
    expect(section.find('h3').exists()).toBe(false);
  });

  it('bureau, sans section IA : le placeholder suit la langue sur la page anglaise', async () => {
    width(true);
    apiWithoutAi();
    const wrapper = await mountPage('/en');

    const section = wrapper.get('#section-ai');
    expect(section.get('h2').text()).toBe('AI');
    expect(section.get('.ai-placeholder__command').text()).toBe('cat ai.md');
    expect(section.text()).toContain('ai.md: still being written…');
  });

  it('mobile et tablette, sans section IA : l’onglet IA n’est pas vide', async () => {
    width(false);
    apiWithoutAi();
    const wrapper = await mountPage('/');

    await wrapper.findAll('.bottom-nav button')[3]!.trigger('click');
    await nextTick();

    const section = wrapper.get('#section-ai');
    expect(section.attributes('hidden')).toBeUndefined();
    expect(section.get('.ai-placeholder__command').text()).toBe('cat ia.md');
  });

  it('avec une section IA : le contenu normal, pas de placeholder', async () => {
    width(true);
    const wrapper = await mountPage('/');

    const section = wrapper.get('#section-ai');
    expect(section.get('h3').text()).toBe(cvFr.aiOverview?.title);
    expect(section.find('.ai-placeholder').exists()).toBe(false);
    expect(wrapper.findAll('.ai-placeholder')).toHaveLength(0);
  });
});
