import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import type { NuxtError } from '#app';
import { useNuxtApp } from '#imports';

import ErrorPage from './error.vue';

// Page « panne du serveur » (D48, lot 35) : la page d'erreur serveur du lot 30, refondue en place.
// error.vue rendue pour l'erreur 404 de `/50x.html` ou `/en/50x.html` (adresse portée par `data.path`,
// routeur de Nuxt) ; le proxy la sert pour 500, 502, 503 et 504. Message clair et rassurant, sans code
// ni détail technique, action « Réessayer » au format des boutons du site qui reste un lien vers
// l'adresse servie (`href=""` : la page n'a pas d'application), retour à l'accueil, fenêtre
// `panne-serveur.log`.

const mounted: VueWrapper[] = [];

beforeEach(async () => {
  await useNuxtApp().$i18n.setLocale('fr');
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

async function mountOutage(route: string, status = 404): Promise<VueWrapper> {
  const error = {
    status,
    data: { path: route },
    statusText: 'ECONNREFUSED 127.0.0.1:3000 upstream',
    message: 'ECONNREFUSED 127.0.0.1:3000 upstream',
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

const PAGES = [
  {
    route: '/50x.html',
    lang: 'fr',
    home: '/',
    title: 'Le serveur est en panne pour l’instant',
    paragraphs: [
      'Le site ne peut pas s’afficher pour le moment. Le problème vient du serveur, pas de votre appareil ni de votre connexion, et il est temporaire.',
      'Rien n’est perdu : réessayez dans quelques instants, ou revenez un peu plus tard.',
    ],
    retry: 'Réessayer',
    back: 'Retour à l’accueil',
  },
  {
    route: '/en/50x.html',
    lang: 'en',
    home: '/en',
    title: 'The server is temporarily down',
    paragraphs: [
      'The site can’t be displayed right now. The problem is on the server’s side, not with your device or your connection, and it’s temporary.',
      'Nothing is lost: please try again in a few moments, or come back a little later.',
    ],
    retry: 'Try again',
    back: 'Back to the home page',
  },
] as const;

describe('error.vue : page « panne du serveur » (D48)', () => {
  for (const expected of PAGES) {
    it(`${expected.lang} à ${expected.route} : titre, message rassurant, fenêtre panne-serveur.log`, async () => {
      const wrapper = await mountOutage(expected.route);

      expect(wrapper.findAll('h1').map((heading) => heading.text())).toEqual([expected.title]);
      const main = wrapper.get('main#contenu');
      expect(main.findAll('.annex-page__body > p').map((paragraph) => paragraph.text())).toEqual(
        expected.paragraphs,
      );
      expect(wrapper.get('.annex-page__bar').text()).toBe('>_ panne-serveur.log');
      expect(document.title).toBe(expected.title);
      expect(document.documentElement.getAttribute('lang')).toBe(expected.lang);
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'noindex',
      );
    });

    it(`${expected.lang} : « ${expected.retry} » est un lien en forme de bouton du site vers l’adresse servie`, async () => {
      const wrapper = await mountOutage(expected.route);

      const main = wrapper.get('main');
      expect(main.findAll('a').map((link) => [link.text(), link.attributes('href')])).toEqual([
        [expected.back, expected.home],
        [expected.retry, ''],
      ]);
      const retry = main.get('.error-page__actions a');
      expect(retry.element.tagName).toBe('A');
      expect(retry.attributes('href')).toBe('');
      expect(retry.classes()).toEqual(
        expect.arrayContaining([
          'base-button',
          'base-button--solid',
          'base-button--lg',
          'error-page__retry',
        ]),
      );
      // Rechargement dans le même onglet : ni nouvel onglet ni `rel`, et aucun script requis.
      expect(retry.attributes('target')).toBeUndefined();
      expect(retry.attributes('rel')).toBeUndefined();
      expect(retry.attributes('onclick')).toBeUndefined();
      // Icône décorative : hors du nom accessible, jamais focalisable.
      const icon = retry.get('.base-button__icon');
      expect(icon.attributes('aria-hidden')).toBe('true');
      expect(icon.get('svg').attributes('focusable')).toBe('false');
      expect(retry.text()).toBe(expected.retry);
    });
  }

  for (const status of [404, 500, 502, 503, 504]) {
    it(`même page quel que soit le statut (${status}) : aucun code ni détail technique affiché`, async () => {
      const wrapper = await mountOutage('/50x.html', status);

      expect(wrapper.get('h1').text()).toBe('Le serveur est en panne pour l’instant');
      const text = wrapper.text();
      expect(text).not.toMatch(/\b(?:404|50\d)\b/);
      expect(text).not.toContain('50x');
      expect(text).not.toContain('ECONNREFUSED');
      expect(text).not.toContain('3000');
      expect(wrapper.find('.error-page__status').exists()).toBe(false);
    });
  }

  it('la page anglaise ne porte aucun libellé de la page française', async () => {
    const wrapper = await mountOutage('/en/50x.html');

    const text = wrapper.text();
    for (const label of [...PAGES[0].paragraphs, PAGES[0].title, PAGES[0].retry, PAGES[0].back]) {
      expect(text).not.toContain(label);
    }
  });

  it('hors de /50x.html, une erreur garde sa page sans le bouton « Réessayer »', async () => {
    const notFound = await mountOutage('/une-page');
    expect(notFound.get('h1').text()).toBe('Page introuvable');
    expect(notFound.find('.error-page__actions').exists()).toBe(false);
    expect(notFound.get('.annex-page__bar').text()).toBe('>_ erreur-404.log');

    const failure = await mountOutage('/une-page', 500);
    expect(failure.get('h1').text()).toBe('Une erreur est survenue');
    expect(failure.find('.error-page__actions').exists()).toBe(false);
    expect(failure.get('.annex-page__bar').text()).toBe('>_ erreur.log');
  });
});
