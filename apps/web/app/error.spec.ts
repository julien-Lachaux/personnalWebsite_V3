import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { NuxtError } from '#app';
import { clearNuxtState, useNuxtApp } from '#imports';

import ErrorPage from './error.vue';
import { PREFERENCES_STATE_KEY } from './composables/shell/usePreferences.js';

// Page d'erreur (F7-01), rendue par Nuxt à la place d'app.vue : 404 « page introuvable » et page
// générique des autres statuts, dans la langue de l'adresse, dans le gabarit des pages annexes, avec
// les devoirs de la racine (lang, lien d'évitement, préférences) et sans indexation.

const mounted: VueWrapper[] = [];

async function flushHead(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  // Chaque test part d'un premier chargement, en français : monter error.vue sur une autre adresse
  // ne repasse pas la langue au français après un test sous /en.
  await useNuxtApp().$i18n.setLocale('fr');
  clearNuxtState(PREFERENCES_STATE_KEY);
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === '(prefers-color-scheme: dark)',
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
});

async function mountError(route: string, status: number | undefined): Promise<VueWrapper> {
  // Erreur telle que la charge utile la transmet (objet simple), statut absent compris.
  const error = {
    status,
    statusText: 'Détail technique à ne pas montrer',
    message: 'Détail technique à ne pas montrer',
    fatal: false,
    unhandled: false,
  } as unknown as NuxtError;
  const wrapper = await mountSuspended(ErrorPage, {
    route,
    props: { error },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  await flushHead();
  return wrapper;
}

describe('error.vue : page introuvable (404)', () => {
  it('en français : h1, texte, retour à l’accueil, titre du document, noindex', async () => {
    const wrapper = await mountError('/page-inconnue', 404);

    expect(wrapper.findAll('h1').map((heading) => heading.text())).toEqual(['Page introuvable']);
    expect(wrapper.get('main').attributes('id')).toBe('contenu');
    expect(wrapper.get('main').text()).toContain(
      'L’adresse demandée ne correspond à aucune page de ce site.',
    );
    const back = wrapper.get('main a');
    expect(back.text()).toBe('Retour à l’accueil');
    expect(back.attributes('href')).toBe('/');
    expect(wrapper.get('.annex-page__bar').text()).toBe('>_ erreur-404.log');
    expect(wrapper.find('.error-page__status').exists()).toBe(false);
    expect(document.title).toBe('Page introuvable');
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex',
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('en anglais sous /en', async () => {
    const wrapper = await mountError('/en/unknown-page', 404);

    expect(wrapper.get('h1').text()).toBe('Page not found');
    expect(wrapper.get('main a').attributes('href')).toBe('/en');
    expect(wrapper.get('main a').text()).toBe('Back to the home page');
    expect(document.title).toBe('Page not found');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('commence par le lien d’évitement, puis l’en-tête du site et ses contrôles', async () => {
    const wrapper = await mountError('/page-inconnue', 404);

    const first = wrapper.find('a, button');
    expect(first.classes()).toContain('skip-link');
    expect(first.attributes('href')).toBe('#contenu');
    expect(first.text()).toBe('Aller au contenu');
    expect(wrapper.findAll('header')).toHaveLength(1);
    expect(wrapper.get('header .language-switch a').attributes('hreflang')).toBe('en');
    expect(wrapper.find('header button[aria-haspopup="dialog"]').exists()).toBe(true);
  });

  it('branche les préférences (attributs de <html> posés au montage)', async () => {
    await mountError('/page-inconnue', 404);

    expect(document.documentElement.getAttribute('data-theme')).toBe('sombre');
  });
});

describe('error.vue : autres erreurs', () => {
  it('affiche une page générique avec le code, sans le détail technique', async () => {
    const wrapper = await mountError('/', 503);

    expect(wrapper.get('h1').text()).toBe('Une erreur est survenue');
    expect(wrapper.get('.error-page__status').text()).toBe('Code de l’erreur : 503');
    expect(wrapper.get('.annex-page__bar').text()).toBe('>_ erreur.log');
    expect(wrapper.get('main a').text()).toBe('Retour à l’accueil');
    expect(wrapper.text()).not.toContain('Détail technique');
    expect(document.title).toBe('Une erreur est survenue');
  });

  it('donne le code 500 à une erreur qui n’en porte pas', async () => {
    const wrapper = await mountError('/en', undefined);

    expect(wrapper.get('h1').text()).toBe('Something went wrong');
    expect(wrapper.get('.error-page__status').text()).toBe('Error code: 500');
  });
});
