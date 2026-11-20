import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import { type LinkView, type RecommendationView } from '../../data/cv-view.js';
import RecommendationsSection from './RecommendationsSection.vue';

const source: LinkView = {
  url: 'https://www.linkedin.com/in/example/details/recommendations/',
  label: 'Recommandations publiées sur LinkedIn',
};

const recommendations: RecommendationView[] = [
  {
    slug: 'premiere',
    author: 'Auteur Un',
    role: 'CTO',
    context: 'Responsable direct de Julien · 8 décembre 2025',
    paragraphs: ['Premier paragraphe de la première.', 'Second paragraphe de la première.'],
    lang: 'fr',
  },
  {
    slug: 'seconde',
    author: 'Auteur Deux',
    role: 'Consulting technique',
    context: 'Responsable direct de Julien · 25 septembre 2020',
    paragraphs: ['Unique paragraphe de la seconde.'],
    lang: 'fr',
  },
];

describe('RecommendationsSection', () => {
  it('place le lien discret vers LinkedIn en haut, en lien externe sécurisé', async () => {
    const wrapper = await mountSuspended(RecommendationsSection, {
      props: { recommendations, source },
    });

    const first = wrapper.get('.recos').element.firstElementChild!;
    expect(first.tagName).toBe('A');
    const link = wrapper.get('a.recos__source');
    expect(link.element).toBe(first);
    expect(link.attributes('href')).toBe(source.url);
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.text()).toContain(source.label);
    expect(link.classes()).toEqual(
      expect.arrayContaining(['base-button--link', 'base-button--tone-linkedin']),
    );
    expect(link.get('.visually-hidden').text()).toBe("(s'ouvre dans un nouvel onglet)");
  });

  it('rend chaque recommandation en figure avec blockquote, auteur, rôle et contexte', async () => {
    const wrapper = await mountSuspended(RecommendationsSection, {
      props: { recommendations, source },
    });

    const figures = wrapper.findAll('figure');
    expect(figures).toHaveLength(2);
    const [first, second] = figures;
    expect(first!.findAll('blockquote p').map((p) => p.text())).toEqual(
      recommendations[0]!.paragraphs,
    );
    expect(first!.get('.reco__author').text()).toBe('Auteur Un');
    expect(first!.get('.reco__role').text()).toBe('CTO');
    expect(first!.get('.reco__context').text()).toBe(
      'Responsable direct de Julien · 8 décembre 2025',
    );
    expect(first!.get('figcaption').element.parentElement).toBe(first!.element);
    expect(second!.findAll('blockquote p')).toHaveLength(1);
    expect(second!.get('.reco__author').text()).toBe('Auteur Deux');
  });

  it('pose lang sur la citation et sa légende : français sur la page anglaise', async () => {
    const wrapper = await mountSuspended(RecommendationsSection, {
      route: '/en',
      props: {
        recommendations: [recommendations[0]!, { ...recommendations[1]!, lang: 'en' }],
        source: { ...source, label: 'Recommendations published on LinkedIn' },
      },
    });

    const figures = wrapper.findAll('figure');
    expect(figures[0]!.get('blockquote').attributes('lang')).toBe('fr');
    expect(figures[0]!.get('figcaption').attributes('lang')).toBe('fr');
    expect(figures[1]!.get('blockquote').attributes('lang')).toBe('en');
    expect(figures[1]!.get('figcaption').attributes('lang')).toBe('en');
    expect(wrapper.get('a.recos__source').text()).toContain(
      'Recommendations published on LinkedIn',
    );
  });

  it('place le bouton « Voir sur LinkedIn » après la dernière recommandation', async () => {
    const wrapper = await mountSuspended(RecommendationsSection, {
      props: { recommendations, source },
    });

    const children = [...wrapper.get('.recos').element.children];
    const list = wrapper.get('.recos__list').element;
    const button = wrapper.get('a.recos__button');
    expect(children.indexOf(button.element)).toBe(children.indexOf(list) + 1);
    expect(button.text()).toContain('Voir sur LinkedIn');
    expect(button.attributes('href')).toBe(source.url);
    expect(button.attributes('target')).toBe('_blank');
    expect(button.attributes('rel')).toBe('noopener noreferrer');
    expect(button.classes()).toEqual(
      expect.arrayContaining(['base-button--linkedin', 'base-button--block']),
    );
  });

  it('affiche l’état vide, sans liste ni bouton du bas, quand aucune recommandation n’est publiée', async () => {
    const wrapper = await mountSuspended(RecommendationsSection, {
      props: { recommendations: [], source },
    });

    expect(wrapper.get('.recos__empty').text()).toBe(
      'Aucune recommandation publiée pour le moment.',
    );
    expect(wrapper.find('ul').exists()).toBe(false);
    expect(wrapper.find('figure').exists()).toBe(false);
    expect(wrapper.find('a.recos__button').exists()).toBe(false);
    expect(wrapper.find('a.recos__source').exists()).toBe(true);
  });

  it('n’affiche pas l’état vide quand il y a des recommandations', async () => {
    const wrapper = await mountSuspended(RecommendationsSection, {
      props: { recommendations, source },
    });

    expect(wrapper.find('.recos__empty').exists()).toBe(false);
  });

  it('masque le lien du haut et le bouton du bas quand l’API ne sert pas l’adresse', async () => {
    const wrapper = await mountSuspended(RecommendationsSection, {
      props: { recommendations, source: null },
    });

    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.findAll('figure')).toHaveLength(2);
  });

  it('cache le guillemet décoratif aux lecteurs d’écran et ne pose pas de titre', async () => {
    const wrapper = await mountSuspended(RecommendationsSection, {
      props: { recommendations, source },
    });

    const marks = wrapper.findAll('svg.reco__mark');
    expect(marks.map((mark) => mark.attributes('aria-hidden'))).toEqual(['true', 'true']);
    expect(wrapper.find('h1, h2, h3, h4').exists()).toBe(false);
  });

  it('parle anglais sur la page anglaise (état vide et bouton)', async () => {
    const empty = await mountSuspended(RecommendationsSection, {
      route: '/en',
      props: { recommendations: [], source },
    });
    const filled = await mountSuspended(RecommendationsSection, {
      route: '/en',
      props: { recommendations, source },
    });

    expect(empty.get('.recos__empty').text()).toBe('No recommendation published yet.');
    expect(filled.get('a.recos__button').text()).toContain('See on LinkedIn');
    expect(filled.get('.visually-hidden').text()).toBe('(opens in a new tab)');
  });
});
