import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import { cvEn } from '../../data/fixtures/cv.en.js';
import { cvFr } from '../../data/fixtures/cv.fr.js';
import { mapCv } from '../../data/map-cv.js';
import { suggest } from '../../domain/filter.js';
import SuggestionList from './SuggestionList.vue';

const labels = {
  present: 'aujourd’hui',
  breakOrganisation: 'Projet personnel',
  workMode: (value: string) => value,
  contractType: (value: string) => value,
};
const view = mapCv(cvFr, labels);
const viewEn = mapCv(cvEn, labels);

function suggestionsFor(query: string, selected: string[] = [], source = view) {
  return suggest(query, source.techs.all, source.experiences, selected);
}

describe('SuggestionList', () => {
  it('liste les suggestions en boutons avec le nombre d’expériences', async () => {
    const wrapper = await mountSuspended(SuggestionList, {
      route: '/',
      props: { id: 'sugg', suggestions: suggestionsFor('script'), query: 'script' },
    });

    expect(wrapper.get('#sugg').attributes('role')).toBe('group');
    expect(wrapper.get('#sugg').attributes('aria-label')).toBe('Suggestions de technos');
    const items = wrapper.findAll('button');
    expect(items.map((item) => item.get('.suggestions__name').text())).toEqual([
      'JavaScript',
      'TypeScript',
    ]);
    expect(items.map((item) => item.get('.suggestions__count').text())).toEqual(['3 XP', '2 XP']);
  });

  it('nomme chaque bouton par l’action et le nombre (pluriel et singulier)', async () => {
    const wrapper = await mountSuspended(SuggestionList, {
      route: '/',
      props: { id: 'sugg', suggestions: suggestionsFor('nest'), query: 'nest' },
    });

    const [nest] = wrapper.findAll('button');
    expect(nest!.attributes('aria-label')).toBe('Ajouter NestJS, 1 XP');

    const many = await mountSuspended(SuggestionList, {
      route: '/',
      props: { id: 'sugg', suggestions: suggestionsFor('typescript'), query: 'typescript' },
    });
    expect(many.get('button').attributes('aria-label')).toBe('Ajouter TypeScript, 2 XP');
  });

  it('émet pick avec le slug au clic sur une suggestion valide', async () => {
    const wrapper = await mountSuspended(SuggestionList, {
      route: '/',
      props: { id: 'sugg', suggestions: suggestionsFor('kafka'), query: 'kafka' },
    });

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('pick')).toEqual([['kafka']]);
    expect(wrapper.get('button').attributes('aria-disabled')).toBeUndefined();
  });

  it('atténue une suggestion qui donnerait 0 résultat (aria-disabled, clic sans effet)', async () => {
    const wrapper = await mountSuspended(SuggestionList, {
      route: '/',
      props: {
        id: 'sugg',
        suggestions: suggestionsFor('node', ['typescript', 'docker']),
        query: 'node',
      },
    });

    const button = wrapper.get('button');
    expect(button.attributes('aria-disabled')).toBe('true');
    expect(button.classes()).toContain('suggestions__item--dim');
    expect(button.attributes('aria-label')).toBe(
      'Node.js, 0 XP : indisponible avec les filtres en cours',
    );
    expect(button.get('.suggestions__count').text()).toBe('0 XP');

    await button.trigger('click');
    expect(wrapper.emitted('pick')).toBeUndefined();
  });

  it('atténue une techno sans expérience détaillée, le dit et affiche « sans XP détaillée »', async () => {
    const wrapper = await mountSuspended(SuggestionList, {
      route: '/',
      props: { id: 'sugg', suggestions: suggestionsFor('git'), query: 'git' },
    });

    const button = wrapper.get('button');
    expect(button.attributes('aria-disabled')).toBe('true');
    expect(button.classes()).toContain('suggestions__item--dim');
    expect(button.attributes('aria-label')).toBe('Git, sans XP détaillée');
    expect(button.get('.suggestions__count').text()).toBe('sans XP détaillée');

    await button.trigger('click');
    expect(wrapper.emitted('pick')).toBeUndefined();
  });

  it('reprend le texte visible dans le nom de chaque bouton (WCAG 2.5.3)', async () => {
    const normalize = (text: string): string =>
      text
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .toLowerCase();
    for (const [query, selected] of [
      ['e', []],
      ['s', ['typescript', 'docker']],
      ['git', []],
    ] as const) {
      const wrapper = await mountSuspended(SuggestionList, {
        route: '/',
        props: { id: 'sugg', suggestions: suggestionsFor(query, [...selected]), query },
      });

      const buttons = wrapper.findAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        const visible = `${button.get('.suggestions__name').text()} ${button.get('.suggestions__count').text()}`;
        expect(normalize(button.attributes('aria-label')!)).toContain(normalize(visible));
      }
    }
  });

  it('sans suggestion : message avec la saisie et lien « Voir toutes les technos »', async () => {
    const wrapper = await mountSuspended(SuggestionList, {
      route: '/',
      props: { id: 'sugg', suggestions: [], query: '  zzz ' },
    });

    const message = wrapper.get('.suggestions__none');
    expect(message.text()).toContain('Aucune techno ne correspond à « zzz ».');
    const link = message.get('button');
    expect(link.text()).toBe('Voir toutes les technos');

    await link.trigger('click');
    expect(wrapper.emitted('show-all')).toHaveLength(1);
  });

  it('n’affiche pas le message quand il y a des suggestions', async () => {
    const wrapper = await mountSuspended(SuggestionList, {
      route: '/',
      props: { id: 'sugg', suggestions: suggestionsFor('kafka'), query: 'kafka' },
    });

    expect(wrapper.find('.suggestions__none').exists()).toBe(false);
  });

  it('parle anglais sur la page anglaise', async () => {
    const wrapper = await mountSuspended(SuggestionList, {
      route: '/en',
      props: { id: 'sugg', suggestions: suggestionsFor('kafka', [], viewEn), query: 'kafka' },
    });
    expect(wrapper.get('button').attributes('aria-label')).toBe('Add Apache Kafka, 2 XP');
    expect(wrapper.get('.suggestions__count').text()).toBe('2 XP');

    const none = await mountSuspended(SuggestionList, {
      route: '/en',
      props: { id: 'sugg', suggestions: [], query: 'zzz' },
    });
    expect(none.get('.suggestions__none').text()).toContain('No tech matches “zzz”.');
    expect(none.get('button').text()).toBe('Show all techs');
  });
});
