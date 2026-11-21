import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtData, useRuntimeConfig } from '#imports';

import { MOSAIC_QUERY } from '../../composables/shell/useShellMode.js';
import { cvEn } from '../../data/fixtures/cv.en.js';
import { cvFr } from '../../data/fixtures/cv.fr.js';
import HomePage from './HomePage.vue';

// Page d'accueil, lot F5c : les quatre sections branchées dans les slots de la coquille (Profil,
// Expérience, Recommandations, IA) avec leur morceau de la vue, un seul `h1` (celui de la coquille, le
// titre visible du profil n'est pas un titre de balise), et la liste de la section Expérience donnée à
// la coquille comme zone qui défile de l'onglet XP.

// Adresse de test : un placeholder, jamais une vraie adresse (SPEC § 11).
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

describe('page d’accueil : sections branchées (bureau)', () => {
  it('en français : profil, expériences, recommandations et IA de la fixture', async () => {
    width(true);
    const wrapper = await mountPage('/');

    const profile = wrapper.get('#section-profile');
    expect(profile.get('.profile-title__first').text()).toBe('Développeur');
    expect(profile.get('.profile-title__accent').text()).toBe('full-stack');
    expect(profile.get('.profile-title .senior-badge').text()).toBe('senior');
    expect(profile.get('.profile-title').element.tagName).toBe('DIV');
    expect(profile.text()).toContain('Depuis 2017, je conçois des API');
    const experience = wrapper.get('#section-experience');
    expect(experience.findAll('article')).toHaveLength(cvFr.experiences.length);
    expect(experience.get('.experience-section__filter').text()).toContain('filtrer par techno');
    expect(wrapper.get('#section-recommendations').findAll('figure')).toHaveLength(
      cvFr.recommendations.length,
    );
    expect(wrapper.get('#section-ai h3').text()).toBe(cvFr.aiOverview?.title);
  });

  it('en anglais : contenu de la fixture anglaise et libellés anglais', async () => {
    width(true);
    const wrapper = await mountPage('/en');

    expect(wrapper.get('#section-profile .profile-title__first').text()).toBe('Full-stack');
    expect(wrapper.get('#section-profile .profile-title__accent').text()).toBe('developer');
    const experience = wrapper.get('#section-experience');
    expect(experience.findAll('article')).toHaveLength(cvEn.experiences.length);
    expect(experience.get('.experience-section__filter').text()).toContain('filter by tech');
    expect(wrapper.get('#section-ai h3').text()).toBe(cvEn.aiOverview?.title);
  });

  it('un seul h1 : celui de la coquille, masqué visuellement ; aucun contenu provisoire', async () => {
    width(true);
    const wrapper = await mountPage('/');

    const headings = wrapper.findAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0]!.text()).toBe('Développeur full-stack');
    expect(headings[0]!.classes()).toContain('visually-hidden');
    // Plus de paragraphe provisoire « 8 expériences », « 3 recommandations » ni titre IA en `p`.
    const paragraphs = wrapper.findAll('main p').map((paragraph) => paragraph.text());
    expect(paragraphs).not.toContain('8 expériences');
    expect(paragraphs).not.toContain('3 recommandations');
    expect(paragraphs).not.toContain(cvFr.aiOverview?.title);
  });
});

describe('page d’accueil : onglet XP (mobile et tablette)', () => {
  it('la section Expérience remplit l’onglet et sa liste est la zone lue par la barre d’actions', async () => {
    width(false);
    const wrapper = await mountPage('/');
    expect(wrapper.get('.experience-section').classes()).toContain('home-page__experience');

    await wrapper.findAll('.bottom-nav button')[1]!.trigger('click');
    await nextTick();

    expect(wrapper.get('main').classes()).toContain('app-shell__main--self-scrolling');
    expect(wrapper.get('#section-experience').classes()).toContain(
      'app-shell__section--self-scrolling',
    );
    const list = wrapper.get('.experience-section__list').element;
    list.scrollTop = 300;
    list.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(wrapper.get('.action-bar').classes()).toContain('action-bar--hidden');
  });
});
