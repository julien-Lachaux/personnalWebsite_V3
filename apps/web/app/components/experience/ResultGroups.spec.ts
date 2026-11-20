import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { ExperienceView } from '../../data/cv-view.js';
import { cvEn } from '../../data/fixtures/cv.en.js';
import { cvFr } from '../../data/fixtures/cv.fr.js';
import { mapCv } from '../../data/map-cv.js';
import ResultGroups from './ResultGroups.vue';

const labels = {
  present: 'aujourd’hui',
  breakOrganisation: 'Projet personnel',
  workMode: (value: string) => value,
  contractType: (value: string) => value,
};
const view = mapCv(cvFr, labels);
const viewEn = mapCv(cvEn, labels);

function only(...slugs: string[]): ExperienceView[] {
  return slugs.map((slug) => view.experiences.find((item) => item.slug === slug)!);
}

async function mountGroups(
  selected: string[],
  options: { experiences?: readonly ExperienceView[]; route?: string; source?: typeof view } = {},
): Promise<VueWrapper> {
  const source = options.source ?? view;
  return mountSuspended(ResultGroups, {
    route: options.route ?? '/',
    props: {
      experiences: options.experiences ?? source.experiences,
      techs: source.techs.all,
      selected,
    },
  });
}

function titles(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.experience-card h3').map((title) => title.text());
}

function toggle(wrapper: VueWrapper) {
  return wrapper.get('.result-groups .base-button--secondary');
}

describe('ResultGroups : sans filtre', () => {
  it('liste toutes les expériences dans l’ordre, sans titre de groupe ni bouton', async () => {
    const wrapper = await mountGroups([]);

    expect(wrapper.findAll('.experience-card')).toHaveLength(8);
    expect(titles(wrapper)[0]).toBe('Senior Software Engineer');
    expect(titles(wrapper)[1]).toBe('Pause professionnelle');
    expect(wrapper.find('.result-groups__title').exists()).toBe(false);
    expect(wrapper.find('.base-button').exists()).toBe(false);
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Liste des expériences');
  });
});

describe('ResultGroups : avec filtre', () => {
  it('une seule techno : « Avec X · N », les autres sont repliées derrière un bouton', async () => {
    const wrapper = await mountGroups(['kafka']);

    expect(wrapper.get('.result-groups__title').text()).toBe('Avec Apache Kafka · 2');
    expect(titles(wrapper)).toEqual(['Software Engineer', 'Head of Chapter ETL']);
    const button = toggle(wrapper);
    expect(button.text()).toBe('Voir les 6 autres expériences');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('.experience-card--dimmed').exists()).toBe(false);
  });

  it('plusieurs technos : « Avec toutes ces technos · N » nomme le groupe de résultats', async () => {
    const wrapper = await mountGroups(['typescript', 'docker']);

    const title = wrapper.get('.result-groups__title');
    expect(title.text()).toBe('Avec toutes ces technos · 2');
    expect(wrapper.get('[role="group"]').attributes('aria-labelledby')).toBe(
      title.attributes('id'),
    );
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBeUndefined();
    expect(titles(wrapper)).toEqual(['Senior Software Engineer', 'Software Engineer']);
  });

  it('déplie les autres atténuées : correspondances partielles d’abord, avec « En partie : X »', async () => {
    const wrapper = await mountGroups(['typescript', 'docker']);

    await toggle(wrapper).trigger('click');

    expect(toggle(wrapper).attributes('aria-expanded')).toBe('true');
    expect(toggle(wrapper).text()).toBe('Masquer les 6 autres expériences');
    const groups = wrapper.findAll('[role="group"]');
    expect(groups).toHaveLength(2);
    const others = groups[1]!;
    const heading = others.get('.result-groups__title');
    expect(heading.text()).toBe('Les autres expériences · 6');
    expect(others.attributes('aria-labelledby')).toBe(heading.attributes('id'));
    expect(others.findAll('h3').map((title) => title.text())).toEqual([
      'Expert Intégration SI & Flux',
      'Head of Chapter ETL',
      'Pause professionnelle',
      'Développeur web freelance',
      'Développeur full-stack',
      'Mentor en développement web',
    ]);
    expect(others.findAll('.experience-card--dimmed')).toHaveLength(6);
    expect(others.findAll('.card-intro__partial').map((line) => line.text())).toEqual([
      'En partie : Docker',
      'En partie : Docker',
    ]);

    await toggle(wrapper).trigger('click');
    expect(wrapper.findAll('[role="group"]')).toHaveLength(1);
    expect(toggle(wrapper).text()).toBe('Voir les 6 autres expériences');
  });

  it('liste les technos correspondantes dans l’ordre du filtre', async () => {
    const wrapper = await mountGroups(['docker', 'php', 'kafka']);

    await toggle(wrapper).trigger('click');

    const partials = wrapper.findAll('.card-intro__partial').map((line) => line.text());
    expect(partials).toContain('En partie : Docker, PHP');
    expect(partials).toContain('En partie : Docker, Apache Kafka');
  });

  it('sans résultat complet : message, bouton pour voir les autres, pas de page vide', async () => {
    const wrapper = await mountGroups(['typescript', 'php']);

    expect(wrapper.get('.result-groups__message').text()).toBe(
      'Aucune expérience ne combine toutes ces technos. Retirez-en une, ou consultez les autres expériences.',
    );
    expect(wrapper.find('.result-groups__title').exists()).toBe(false);
    expect(wrapper.findAll('.experience-card')).toHaveLength(0);
    const button = toggle(wrapper);
    expect(button.text()).toBe('Voir les 8 expériences');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(wrapper.findAll('.base-button')).toHaveLength(1);

    await button.trigger('click');

    expect(toggle(wrapper).text()).toBe('Masquer les 8 expériences');
    expect(toggle(wrapper).attributes('aria-expanded')).toBe('true');
    expect(wrapper.findAll('.experience-card--dimmed')).toHaveLength(8);
    expect(wrapper.findAll('.base-button')).toHaveLength(1);
    expect(wrapper.get('.result-groups__title').text()).toBe('Les autres expériences · 8');
    expect(wrapper.findAll('.card-intro__partial')).toHaveLength(6);
  });

  it('accorde les boutons au singulier', async () => {
    const withFull = await mountGroups(['typescript'], {
      experiences: only('nopillo', 'wynd-etl'),
    });
    expect(toggle(withFull).text()).toBe('Voir l’autre expérience');
    await toggle(withFull).trigger('click');
    expect(toggle(withFull).text()).toBe('Masquer l’autre expérience');
    expect(withFull.findAll('.result-groups__title')[1]!.text()).toBe('Les autres expériences · 1');

    const noFull = await mountGroups(['typescript'], { experiences: only('wynd-etl') });
    expect(toggle(noFull).text()).toBe('Voir l’expérience');
    await toggle(noFull).trigger('click');
    expect(toggle(noFull).text()).toBe('Masquer l’expérience');
  });

  it('n’affiche aucun bouton quand toutes les expériences sont dans le résultat', async () => {
    const wrapper = await mountGroups(['kafka'], {
      experiences: only('contentsquare', 'wynd-etl'),
    });

    expect(wrapper.find('.base-button').exists()).toBe(false);
  });

  it('replie les autres quand le filtre change', async () => {
    const wrapper = await mountGroups(['kafka']);
    await toggle(wrapper).trigger('click');
    expect(wrapper.findAll('.experience-card--dimmed').length).toBeGreaterThan(0);

    await wrapper.setProps({ selected: ['kafka', 'docker'] });

    expect(wrapper.find('.experience-card--dimmed').exists()).toBe(false);
    expect(toggle(wrapper).attributes('aria-expanded')).toBe('false');
  });

  it('retransmet le filtre demandé par une puce et l’ouverture de l’easter egg', async () => {
    const wrapper = await mountGroups([]);

    await wrapper.findAll('.card-stack button')[0]!.trigger('click');
    expect(wrapper.emitted('toggle')).toEqual([['typescript']]);

    const pause = wrapper
      .findAll('.experience-card')
      .find((card) => card.text().includes('Pause professionnelle'))!;
    const chip = pause.get('.card-stack button');
    await chip.trigger('click');
    expect(wrapper.emitted('easter-egg')).toEqual([[chip.element]]);
  });

  it('retransmet aussi les puces des cartes atténuées', async () => {
    const wrapper = await mountGroups(['kafka']);
    await toggle(wrapper).trigger('click');

    await wrapper.get('.experience-card--dimmed .card-stack button').trigger('click');

    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });
});

describe('ResultGroups : anglais', () => {
  it('parle anglais sur la page anglaise', async () => {
    const wrapper = await mountGroups(['typescript', 'docker'], { route: '/en', source: viewEn });

    expect(wrapper.get('.result-groups__title').text()).toBe('With all these techs · 2');
    expect(toggle(wrapper).text()).toBe('Show the 6 other experiences');
    await toggle(wrapper).trigger('click');
    expect(wrapper.findAll('.result-groups__title')[1]!.text()).toBe('The other experiences · 6');
    expect(wrapper.findAll('.card-intro__partial')[0]!.text()).toBe('Partly: Docker');

    const one = await mountGroups(['kafka'], { route: '/en', source: viewEn });
    expect(one.get('.result-groups__title').text()).toBe('With Apache Kafka · 2');

    const none = await mountGroups(['typescript', 'php'], { route: '/en', source: viewEn });
    expect(none.get('.result-groups__message').text()).toBe(
      'No experience combines all these techs. Remove one, or look at the other experiences.',
    );
    expect(toggle(none).text()).toBe('Show the 8 experiences');

    const list = await mountGroups([], { route: '/en', source: viewEn });
    expect(list.get('[role="group"]').attributes('aria-label')).toBe('List of experiences');
  });
});
