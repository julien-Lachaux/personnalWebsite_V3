import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, type Component } from 'vue';
import { useHead } from '#imports';

import { usePageSeo, useSiteSeo } from './useSeo.js';

// Méta de référencement (F7-03) : défauts de la langue (app.vue), remplacés par ceux d'une page.

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

/** Monte le composant et attend qu'unhead ait reporté l'en-tête dans le document. */
async function mount(component: Component, route: string): Promise<void> {
  mounted.push(await mountSuspended(component, { route }));
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function meta(selector: string): string | null {
  return document.head.querySelector(`meta[${selector}]`)?.getAttribute('content') ?? null;
}

/* eslint-disable vue/one-component-per-file -- deux racines de test sans gabarit (fonctions de rendu). */

/** Racine qui pose les défauts, avec une page qui n'a qu'un titre (comme l'accueil). */
const TitleOnly = defineComponent({
  setup() {
    useSiteSeo();
    useHead({ title: 'Prénom Nom · Développeur full-stack' });
    return () => h('p', 'accueil');
  },
});

/** Racine qui pose les défauts, avec une page qui a son titre et sa description. */
const OwnSeo = defineComponent({
  setup() {
    const { t } = useI18n();
    useSiteSeo();
    usePageSeo(() => ({
      title: t('declaration.title'),
      description: `Description : ${t('declaration.title')}`,
    }));
    return () => h('p', 'page');
  },
});

describe('useSiteSeo', () => {
  it('donne la description de la langue et un Open Graph minimal dont le titre suit celui de la page', async () => {
    await mount(TitleOnly, '/');

    const description =
      'Site et CV de Julien Lachaux, développeur full-stack : expériences, technologies, recommandations et place de l’IA dans son travail.';
    expect(meta('name="description"')).toBe(description);
    expect(meta('property="og:description"')).toBe(description);
    expect(meta('property="og:type"')).toBe('website');
    expect(meta('property="og:title"')).toBe('Prénom Nom · Développeur full-stack');
    expect(meta('property="og:image"')).toBeNull();
  });

  it('en anglais', async () => {
    await mount(TitleOnly, '/en');

    expect(meta('name="description"')).toBe(
      'Website and CV of Julien Lachaux, full-stack developer: experience, technologies, recommendations and the place of AI in his work.',
    );
  });
});

describe('usePageSeo', () => {
  it('remplace titre et description (et og:description) par ceux de la page, dans sa langue', async () => {
    await mount(OwnSeo, '/en');

    expect(document.title).toBe('Accessibility statement');
    expect(meta('name="description"')).toBe('Description : Accessibility statement');
    expect(meta('property="og:description"')).toBe('Description : Accessibility statement');
    expect(meta('property="og:title"')).toBe('Accessibility statement');
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  });
});
