import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import type { NuxtError } from '#app';
import { useNuxtApp } from '#imports';

import ErrorPage from './error.vue';

// Page d'erreur serveur (lot 30) : error.vue rendue pour l'erreur 404 de l'adresse `/50x.html` ou
// `/en/50x.html` (le routeur n'y trouve aucune page au prérendu ; son erreur porte l'adresse dans
// `data.path`, routeur de Nuxt) affiche la page des réponses 500, 502, 503 et
// 504 : message générique sans code ni détail, « Réessayer » vers l'adresse courante, retour à l'accueil,
// en-tête sans contrôles (page servie sans JavaScript), noindex sans canonique.

const mounted: VueWrapper[] = [];

beforeEach(async () => {
  await useNuxtApp().$i18n.setLocale('fr');
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

async function mountError(
  route: string,
  status: number,
  data: unknown = { path: route },
): Promise<VueWrapper> {
  // Erreur telle que le routeur la crée pour une adresse sans page : `data.path` = l'adresse.
  const error = {
    status,
    data,
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
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return wrapper;
}

describe('error.vue : page d’erreur serveur', () => {
  it('une 404 d’une autre adresse reste la page introuvable', async () => {
    const wrapper = await mountError('/en/404.html', 404);

    expect(wrapper.get('h1').text()).toBe('Page not found');
    expect(wrapper.find('.error-page__retry').exists()).toBe(false);
    expect(wrapper.find('header .header-controls').exists()).toBe(true);
  });

  it('une donnée d’erreur sans adresse ne désigne pas la page d’erreur serveur', async () => {
    const wrapper = await mountError('/50x.html', 404, 'texte');

    expect(wrapper.get('h1').text()).toBe('Page introuvable');
  });

  it('en français à /50x.html : message, réessayer, retour à l’accueil, sans code ni détail', async () => {
    const wrapper = await mountError('/50x.html', 404);

    expect(wrapper.findAll('h1').map((heading) => heading.text())).toEqual([
      'Site indisponible pour l’instant',
    ]);
    const main = wrapper.get('main');
    expect(main.attributes('id')).toBe('contenu');
    expect(main.text()).toContain('Le serveur n’a pas pu répondre à votre demande.');
    expect(wrapper.get('.annex-page__bar').text()).toBe('>_ erreur-50x.log');
    expect(main.findAll('a').map((link) => [link.text(), link.attributes('href')])).toEqual([
      ['Retour à l’accueil', '/'],
      ['Réessayer', ''],
    ]);
    expect(wrapper.find('.error-page__status').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('404');
    expect(wrapper.text()).not.toContain('Détail technique');
    expect(document.title).toBe('Site indisponible pour l’instant');
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex',
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelectorAll('link[rel="alternate"]')).toHaveLength(0);
  });

  it('en anglais à /en/50x.html', async () => {
    const wrapper = await mountError('/en/50x.html', 404);

    expect(wrapper.get('h1').text()).toBe('Website temporarily unavailable');
    expect(wrapper.get('main').text()).toContain('The server could not answer your request.');
    expect(
      wrapper
        .get('main')
        .findAll('a')
        .map((link) => [link.text(), link.attributes('href')]),
    ).toEqual([
      ['Back to the home page', '/en'],
      ['Try again', ''],
    ]);
    expect(document.title).toBe('Website temporarily unavailable');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('garde le lien d’évitement et le lien du site, sans les contrôles de l’en-tête', async () => {
    const wrapper = await mountError('/50x.html', 404);

    const first = wrapper.find('a, button');
    expect(first.classes()).toContain('skip-link');
    expect(first.attributes('href')).toBe('#contenu');
    const header = wrapper.get('header');
    expect(header.findAll('button')).toHaveLength(0);
    expect(header.findAll('a').map((link) => link.attributes('href'))).toEqual(['/']);
  });

  it('ne dépend pas du statut de l’erreur : même page pour un 503', async () => {
    const wrapper = await mountError('/50x.html', 503);

    expect(wrapper.get('h1').text()).toBe('Site indisponible pour l’instant');
    expect(wrapper.find('.error-page__status').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('503');
  });

  it('ailleurs, une erreur 500 garde la page générique avec son code et ses contrôles', async () => {
    const wrapper = await mountError('/une-page', 500, null);

    expect(wrapper.get('h1').text()).toBe('Une erreur est survenue');
    expect(wrapper.get('.error-page__status').text()).toBe('Code de l’erreur : 500');
    expect(wrapper.find('.error-page__retry').exists()).toBe(false);
    expect(wrapper.find('header .header-controls').exists()).toBe(true);
  });
});
