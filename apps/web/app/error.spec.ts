import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, onMounted, ref } from 'vue';
import { clearNuxtState, createError, useState } from '#imports';

import ErrorPage from './error.vue';

// Page d'erreur provisoire (lot F9a, contenu en F7) : 404 et autre erreur dans les deux langues, sans
// script ni style injecté (CSP stricte) ; textes du rendu repris tels quels à l'hydratation, puis
// langue de l'adresse une fois montée.

async function flushHead(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  clearNuxtState('error-page-texts');
});

describe('page d’erreur', () => {
  it('404 en français : titre, explication, retour à l’accueil, cible du lien d’évitement', async () => {
    const wrapper = await mountSuspended(ErrorPage, {
      route: '/route-inconnue',
      props: { error: createError({ status: 404 }) },
    });
    await flushHead();

    expect(wrapper.get('main').attributes('id')).toBe('contenu');
    expect(wrapper.get('h1').text()).toBe('Page introuvable');
    expect(wrapper.text()).toContain('Cette adresse ne correspond à aucune page du site.');
    expect(wrapper.get('a').attributes('href')).toBe('/');
    expect(wrapper.get('a').text()).toBe('Retour à l’accueil');
    expect(document.title).toBe('Page introuvable');
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
  });

  it('404 en anglais sous /en', async () => {
    const wrapper = await mountSuspended(ErrorPage, {
      route: '/en/route-inconnue',
      props: { error: createError({ status: 404 }) },
    });
    await flushHead();

    expect(wrapper.get('h1').text()).toBe('Page not found');
    expect(wrapper.get('a').attributes('href')).toBe('/en');
    expect(wrapper.get('a').text()).toBe('Back to the home page');
    expect(document.title).toBe('Page not found');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('autre erreur : message générique, jamais le détail de l’erreur', async () => {
    const wrapper = await mountSuspended(ErrorPage, {
      route: '/accessibilite',
      props: { error: createError({ status: 500, message: 'détail interne' }) },
    });

    expect(wrapper.get('h1').text()).toBe('Erreur');
    expect(wrapper.text()).toContain('La page n’a pas pu s’afficher.');
    expect(wrapper.text()).not.toContain('détail interne');
  });

  it('hydrate avec les textes du rendu (charge utile), puis prend la langue de l’adresse', async () => {
    // Rendu au build en français (404.html), servi sous /en : la charge utile porte ces textes.
    const rendered = {
      lang: 'fr',
      title: 'Page introuvable',
      message: 'Cette adresse ne correspond à aucune page du site.',
      back: 'Retour à l’accueil',
      home: '/',
    };
    useState('error-page-texts', () => rendered);
    // Le parent est monté juste après la page, avant son nouveau rendu : il lit le premier rendu.
    let firstRender = '';
    const Host = defineComponent({
      setup() {
        const root = ref<HTMLElement>();
        onMounted(() => {
          firstRender = root.value?.textContent ?? '';
        });
        return () =>
          h('div', { ref: root }, [h(ErrorPage, { error: createError({ status: 404 }) })]);
      },
    });

    const wrapper = await mountSuspended(Host, { route: '/en/route-inconnue' });
    await flushHead();

    expect(firstRender).toContain('Page introuvable');
    expect(firstRender).not.toContain('Page not found');
    expect(useState('error-page-texts').value).toEqual(rendered);
    expect(wrapper.get('h1').text()).toBe('Page not found');
    expect(wrapper.get('a').attributes('href')).toBe('/en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });
});
