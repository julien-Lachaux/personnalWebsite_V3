import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import type { ExperienceView } from '../../data/cv-view.js';
import { cvEn } from '../../data/fixtures/cv.en.js';
import { cvFr } from '../../data/fixtures/cv.fr.js';
import { mapCv } from '../../data/map-cv.js';
import ExperienceCard from './ExperienceCard.vue';

const view = mapCv(cvFr, {
  present: 'aujourd’hui',
  breakOrganisation: 'Projet personnel',
  workMode: (value) => `mode:${value}`,
  contractType: (value) => `contrat:${value}`,
});
const viewEn = mapCv(cvEn, {
  present: 'present',
  breakOrganisation: 'Personal project',
  workMode: (value) => `mode:${value}`,
  contractType: (value) => `contract:${value}`,
});

function experience(slug: string, source = view): ExperienceView {
  return source.experiences.find((item) => item.slug === slug)!;
}

describe('ExperienceCard : contenu', () => {
  it('affiche intitulé, organisation, période, lieu, résumé et puces dans l’ordre de la SPEC', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: experience('nopillo'), selected: [] },
    });

    const article = wrapper.get('article');
    const title = wrapper.get('h3');
    expect(title.text()).toBe('Senior Software Engineer');
    expect(article.attributes('aria-labelledby')).toBe(title.attributes('id'));
    expect(wrapper.get('.card-header__org').text()).toBe('@ Nopillo');
    expect(wrapper.get('.card-header__period').text()).toBe('janv. 2026 – mai 2026');
    expect(wrapper.get('.card-intro__meta').text()).toBe('Paris, mode:hybrid · contrat:cdi');
    expect(wrapper.get('.card-intro__summary').text()).toBe(
      "Intégration de fonctionnalités d'IA dans le produit.",
    );
    expect(wrapper.findAll('.card-stack button').map((chip) => chip.text())).toEqual([
      'TypeScript',
      'Elysia.js',
      'Solid.js',
      'Mastra',
      'PostHog',
      'Docker',
    ]);

    const order = [
      '.card-header__title',
      '.card-header__org',
      '.card-header__period',
      '.card-intro__meta',
      '.card-intro__summary',
      '.experience-card__details',
      '.card-stack',
    ].map((selector) => article.element.innerHTML.indexOf(selector.slice(1)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('cache le symbole @ aux lecteurs d’écran', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: experience('nopillo'), selected: [] },
    });

    const symbol = wrapper.get('.card-header__org span');
    expect(symbol.text()).toBe('@');
    expect(symbol.attributes('aria-hidden')).toBe('true');
  });

  it('masque la ligne de lieu quand elle est vide, l’organisation et la pile quand elles manquent', async () => {
    const bare: ExperienceView = {
      ...experience('nopillo'),
      organisation: null,
      meta: '',
      summary: '',
      stack: [],
    };
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: bare, selected: [] },
    });

    expect(wrapper.find('.card-header__org').exists()).toBe(false);
    expect(wrapper.find('.card-intro__meta').exists()).toBe(false);
    expect(wrapper.find('.card-intro__summary').exists()).toBe(false);
    expect(wrapper.find('.card-stack').exists()).toBe(false);
  });

  it('atténue une carte repliée derrière « Voir les N autres » et dit ce qui correspond', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: {
        experience: experience('wynd-etl'),
        selected: ['docker'],
        dimmed: true,
        partial: 'En partie : Docker',
      },
    });

    expect(wrapper.get('article').classes()).toContain('experience-card--dimmed');
    expect(wrapper.get('.card-intro__partial').text()).toBe('En partie : Docker');

    const plain = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: experience('wynd-etl'), selected: [] },
    });
    expect(plain.get('article').classes()).not.toContain('experience-card--dimmed');
    expect(plain.find('.card-intro__partial').exists()).toBe(false);
  });
});

describe('ExperienceCard : détail en accordéon', () => {
  it('est replié au départ : bouton nommé, aria-expanded et aria-controls', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: experience('nopillo'), selected: [] },
    });

    const toggle = wrapper.get('.accordion__toggle');
    expect(toggle.attributes('aria-label')).toBe('Détail : Senior Software Engineer chez Nopillo');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    const panel = wrapper.get(`#${toggle.attributes('aria-controls')}`);
    expect(panel.attributes('inert')).toBeDefined();
    expect(panel.findAll('li')).toHaveLength(4);
    expect(panel.get('li').text()).toContain(
      "Développement d'un système d'OCR pour les tickets de caisse et les factures",
    );
  });

  it('se déplie puis se replie au clic', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: experience('nopillo'), selected: [] },
    });
    const toggle = wrapper.get('.accordion__toggle');
    const panel = () => wrapper.get(`#${toggle.attributes('aria-controls')}`);

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(panel().attributes('inert')).toBeUndefined();

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(panel().attributes('inert')).toBeDefined();
  });

  it('nomme le détail sans organisation quand elle manque', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: { ...experience('nopillo'), organisation: null }, selected: [] },
    });

    expect(wrapper.get('.accordion__toggle').attributes('aria-label')).toBe(
      'Détail : Senior Software Engineer',
    );
  });

  it('n’a pas d’accordéon sans détail (mentorat, mission courte)', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: experience('openclassrooms-mentor'), selected: [] },
    });

    expect(wrapper.find('.accordion__toggle').exists()).toBe(false);
    expect(wrapper.get('h3').text()).toBe('Mentor en développement web');
    expect(wrapper.find('.experience-card__details').exists()).toBe(false);
  });
});

describe('ExperienceCard : puces de stack', () => {
  it('active la puce d’une techno choisie (aria-pressed) et nomme chaque puce', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: experience('nopillo'), selected: ['docker'] },
    });

    const chips = wrapper.findAll('.card-stack button');
    expect(chips.map((chip) => chip.attributes('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'false',
      'false',
      'true',
    ]);
    expect(chips[0]!.attributes('aria-label')).toBe('Filtrer par TypeScript');
    expect(chips[0]!.classes()).toContain('tech-chip--sm');
  });

  it('émet toggle avec le slug de la techno au clic', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: experience('nopillo'), selected: [] },
    });

    await wrapper.findAll('.card-stack button')[1]!.trigger('click');

    expect(wrapper.emitted('toggle')).toEqual([['elysia']]);
    expect(wrapper.emitted('easter-egg')).toBeUndefined();
  });

  it('émet toggle aussi depuis une carte sans détail', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: experience('openclassrooms-mentor'), selected: [] },
    });

    await wrapper.findAll('.card-stack button')[0]!.trigger('click');

    expect(wrapper.emitted('toggle')).toEqual([['php']]);
  });

  it('la puce « Huile de coude » n’est pas un filtre : elle ouvre l’easter egg avec la puce pour le focus', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/',
      props: { experience: experience('pause-professionnelle'), selected: ['docker'] },
    });

    expect(wrapper.get('.card-header__org').text()).toBe('› Projet personnel');
    expect(wrapper.find('.accordion__toggle').exists()).toBe(false);
    const chip = wrapper.get('.card-stack button');
    expect(chip.text()).toBe('Huile de coude');
    expect(chip.attributes('aria-pressed')).toBeUndefined();
    expect(chip.attributes('aria-label')).toBeUndefined();

    await chip.trigger('click');

    expect(wrapper.emitted('easter-egg')).toEqual([[chip.element]]);
    expect(wrapper.emitted('toggle')).toBeUndefined();
  });
});

describe('ExperienceCard : anglais', () => {
  it('parle anglais sur la page anglaise', async () => {
    const wrapper = await mountSuspended(ExperienceCard, {
      route: '/en',
      props: { experience: experience('nopillo', viewEn), selected: [] },
    });

    expect(wrapper.get('.accordion__toggle').attributes('aria-label')).toBe(
      'Details: Senior Software Engineer at Nopillo',
    );
    expect(wrapper.get('.card-stack button').attributes('aria-label')).toBe('Filter by TypeScript');
    expect(wrapper.get('.card-header__period').text()).toBe('Jan 2026 – May 2026');
  });
});
