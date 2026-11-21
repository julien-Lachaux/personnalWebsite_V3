import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtData, useRuntimeConfig } from '#imports';

import { cvFr } from '../../data/fixtures/cv.fr.js';
import { cvEn } from '../../data/fixtures/cv.en.js';
import { MOSAIC_QUERY } from '../../composables/shell/useShellMode.js';
import HomePage from './HomePage.vue';

// Page d'accueil réelle (F3a) : CV de la langue lu par `useCv` (fixtures ou API), contenu provisoire de
// chaque section tiré des données, titre de la page, coquille.

// Adresse de test : un placeholder, jamais une vraie adresse (SPEC § 11).
const PLACEHOLDER = 'contact@example.org';

interface Saved {
  contactEmail: string;
  cvSource: string;
  apiBaseUrl: string;
}

let saved: Saved;
const mounted: VueWrapper[] = [];

/** Bureau (mosaïque) : les quatre sections sont rendues ensemble. */
function desktop(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === MOSAIC_QUERY,
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

/** Attend que unhead ait reporté l'en-tête dans le document (mise à jour asynchrone). */
async function flushHead(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
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
  desktop();
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

describe('page d’accueil (fixtures)', () => {
  it('en français : un seul h1, accroches et contenu de la fixture dans chaque section', async () => {
    const wrapper = await mountPage('/');

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.get('h1').text()).toBe('Développeur full-stack');
    const profile = wrapper.get('#section-profile');
    expect(profile.get('.senior-badge').text()).toBe('senior');
    expect(profile.findAll('.profile__tagline').map((item) => item.text())).toEqual([
      'NestJS, Vue.js — données, ETL et analytics',
      'Développement assisté par IA et agentique',
    ]);
    expect(profile.text()).toContain('Depuis 2017, je conçois des API');
    const experience = wrapper.get('#section-experience');
    expect(experience.get('[role="search"]').attributes('aria-label')).toBe(
      'Filtrer les expériences',
    );
    expect(experience.text()).toContain('filtrer par techno');
    expect(experience.text()).toContain('OpenClassrooms');
    expect(wrapper.get('#section-recommendations').text()).toContain('Voir sur LinkedIn');
    expect(wrapper.get('#section-ai').text()).toContain(cvFr.aiOverview?.title);
  });

  it('en anglais : contenu de la fixture anglaise et libellés anglais', async () => {
    const wrapper = await mountPage('/en');

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.get('h1').text()).toBe('Full-stack developer');
    expect(
      wrapper
        .get('#section-profile')
        .findAll('.profile__tagline')
        .map((item) => item.text()),
    ).toEqual(['NestJS, Vue.js — data, ETL and analytics', 'AI-assisted and agentic development']);
    const experience = wrapper.get('#section-experience');
    expect(experience.get('[role="search"]').attributes('aria-label')).toBe('Filter experiences');
    expect(experience.text()).toContain('filter by tech');
    expect(wrapper.get('#section-ai').text()).toContain(cvEn.aiOverview?.title);
  });

  it('donne à la page le titre « prénom nom · titre du profil »', async () => {
    await mountPage('/');
    await flushHead();

    expect(document.title).toBe('Prénom Nom · Développeur full-stack');
  });

  it('relie le CV PDF de la langue et la déclaration d’accessibilité localisée', async () => {
    const wrapper = await mountPage('/en');

    // Pas de cv-en.pdf (D22) : le lien mène au CV français, le dit dans son nom et par hreflang.
    const cv = wrapper.get('a[download]');
    expect(cv.attributes()).toMatchObject({ href: '/cv/cv-fr.pdf', hreflang: 'fr' });
    expect(cv.text()).toContain('(in French)');
    expect(wrapper.get('.a11y-panel__link').attributes('href')).toBe('/en/accessibilite');
  });
});

describe('page d’accueil (API)', () => {
  it('lit l’API configurée ; sans section IA, rien n’est affiché dans la section', async () => {
    registerEndpoint('http://api.page.test/api/v1/cv', {
      method: 'GET',
      handler: () => ({ ...cvFr, aiOverview: null }),
    });
    const config = useRuntimeConfig();
    config.cvSource = 'api';
    config.apiBaseUrl = 'http://api.page.test';

    const wrapper = await mountPage('/');

    expect(wrapper.get('h1').text()).toBe('Développeur full-stack');
    expect(wrapper.get('#section-ai').findAll('p')).toEqual([]);
    expect(wrapper.get('#section-ai h2').text()).toBe('IA');
  });
});
