import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import { cvEn } from '../../data/fixtures/cv.en.js';
import { cvFr } from '../../data/fixtures/cv.fr.js';
import { mapCv } from '../../data/map-cv.js';
import { techCounters } from '../../domain/filter.js';
import FilterDrawer from './FilterDrawer.vue';

const labels = {
  present: 'aujourd’hui',
  breakOrganisation: 'Projet personnel',
  workMode: (value: string) => value,
  contractType: (value: string) => value,
};
const view = mapCv(cvFr, labels);
const viewEn = mapCv(cvEn, labels);

function propsFor(selected: string[] = [], open = true, source = view) {
  const counters = new Map(
    techCounters(source.techs.all, source.experiences, selected).map((item) => [item.slug, item]),
  );
  return {
    id: 'drawer',
    open,
    techs: source.techs,
    counterOf: (slug: string) => counters.get(slug)!,
  };
}

describe('FilterDrawer', () => {
  it('liste la stack principale dans l’ordre des rangs, avec les compteurs', async () => {
    const wrapper = await mountSuspended(FilterDrawer, { route: '/', props: propsFor() });

    expect(wrapper.get('.filter-drawer__label').text()).toBe('stack principale');
    const chips = wrapper.findAll('.filter-drawer__quick button');
    expect(chips.map((chip) => chip.attributes('aria-label'))).toEqual([
      'TypeScript, 2 expériences',
      'Node.js, 1 expérience',
      'NestJS, 1 expérience',
      'Vue.js (2 et 3), 1 expérience',
      'PostgreSQL, 1 expérience',
      'Apache Kafka, 2 expériences',
      'Docker, 4 expériences',
    ]);
  });

  it('est ouvert et atteignable quand `open`, replié et inerte sinon', async () => {
    const opened = await mountSuspended(FilterDrawer, { route: '/', props: propsFor() });
    expect(opened.get('#drawer').classes()).toContain('filter-drawer--open');
    expect(opened.get('#drawer').attributes('inert')).toBeUndefined();

    const closed = await mountSuspended(FilterDrawer, {
      route: '/',
      props: propsFor([], false),
    });
    expect(closed.get('#drawer').classes()).not.toContain('filter-drawer--open');
    expect(closed.get('#drawer').attributes('inert')).toBeDefined();
  });

  it('retire de la stack principale une techno sans expérience', async () => {
    const source = {
      ...view,
      experiences: view.experiences.filter((experience) => experience.slug !== 'afluens'),
    };
    const base = propsFor([], true, source);
    const wrapper = await mountSuspended(FilterDrawer, {
      route: '/',
      props: {
        ...base,
        counterOf: (slug: string) =>
          slug === 'nodejs'
            ? { slug, state: 'unlinked' as const, count: 0, total: 0, selectable: false }
            : base.counterOf(slug),
      },
    });

    const quick = wrapper.get('.filter-drawer__quick');
    expect(quick.text()).not.toContain('Node.js');
    expect(quick.findAll('button')).toHaveLength(6);
    expect(quick.findAll('.tech-chip--dashed')).toHaveLength(0);
  });

  it('émet toggle avec le slug quand on choisit une techno, sans se fermer', async () => {
    const wrapper = await mountSuspended(FilterDrawer, { route: '/', props: propsFor() });

    await wrapper.findAll('.filter-drawer__quick button')[5]!.trigger('click');

    expect(wrapper.emitted('toggle')).toEqual([['kafka']]);
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('marque les technos choisies et grise celles qui donneraient 0 résultat', async () => {
    const wrapper = await mountSuspended(FilterDrawer, {
      route: '/',
      props: propsFor(['typescript', 'docker']),
    });

    const chips = wrapper.findAll('.filter-drawer__quick button');
    expect(chips[0]!.attributes('aria-pressed')).toBe('true');
    expect(chips[1]!.attributes('aria-disabled')).toBe('true');
    expect(chips[6]!.attributes('aria-pressed')).toBe('true');
  });

  it('émet close avec le bouton Fermer', async () => {
    const wrapper = await mountSuspended(FilterDrawer, { route: '/', props: propsFor() });

    const close = wrapper.get('.filter-drawer__close');
    expect(close.text()).toBe('Fermer');
    await close.trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  describe('« Toutes les technos »', () => {
    it('est un bouton qui annonce le nombre de technos et pilote son contenu', async () => {
      const wrapper = await mountSuspended(FilterDrawer, { route: '/', props: propsFor() });

      const toggle = wrapper.get('.filter-drawer__actions button');
      expect(toggle.text()).toBe('Toutes les technos (34)');
      expect(toggle.attributes('aria-expanded')).toBe('false');
      const controlled = toggle.attributes('aria-controls')!;
      expect(wrapper.find(`#${controlled}`).exists()).toBe(true);
      expect(wrapper.find('.all-techs').exists()).toBe(false);
    });

    it('déplie toutes les technos par domaine, à la place de la stack principale', async () => {
      const wrapper = await mountSuspended(FilterDrawer, { route: '/', props: propsFor() });

      await wrapper.get('.filter-drawer__actions button').trigger('click');

      const toggle = wrapper.get('.filter-drawer__actions button');
      expect(toggle.text()).toBe('Masquer la liste');
      expect(toggle.attributes('aria-expanded')).toBe('true');
      expect(wrapper.find('.filter-drawer__quick').exists()).toBe(false);
      expect(wrapper.get('.all-techs__intro').text()).toContain('Toutes mes technos, par domaine.');
      const groups = wrapper.findAll('.all-techs__group');
      expect(groups).toHaveLength(7);
      expect(groups[0]!.attributes('role')).toBe('group');
      const title = groups[0]!.get('.all-techs__title');
      expect(groups[0]!.attributes('aria-labelledby')).toBe(title.attributes('id'));
      expect(title.text()).toBe('Langages et frameworks');
      expect(wrapper.findAll('.all-techs__items > *')).toHaveLength(34);
    });

    it('met les technos sans expérience en pointillé et les autres en boutons', async () => {
      const wrapper = await mountSuspended(FilterDrawer, { route: '/', props: propsFor() });

      await wrapper.get('.filter-drawer__actions button').trigger('click');

      expect(wrapper.findAll('.tech-chip--dashed').length).toBeGreaterThan(0);
      for (const chip of wrapper.findAll('.tech-chip--dashed')) {
        expect(chip.element.tagName).toBe('SPAN');
      }
      const buttons = wrapper.findAll('.all-techs button');
      expect(buttons.length + wrapper.findAll('.tech-chip--dashed').length).toBe(34);
    });

    it('émet toggle quand on choisit une techno de la liste complète', async () => {
      const wrapper = await mountSuspended(FilterDrawer, { route: '/', props: propsFor() });
      await wrapper.get('.filter-drawer__actions button').trigger('click');

      const redis = wrapper
        .findAll('.all-techs button')
        .find((button) => button.attributes('aria-label')?.startsWith('Redis'))!;
      await redis.trigger('click');

      expect(wrapper.emitted('toggle')).toEqual([['redis']]);
    });

    it('reste déplié à la réouverture (v-model:all-open)', async () => {
      const wrapper = await mountSuspended(FilterDrawer, {
        route: '/',
        props: { ...propsFor(), allOpen: true },
      });

      expect(wrapper.find('.all-techs').exists()).toBe(true);
      expect(wrapper.get('.filter-drawer__actions button').attributes('aria-expanded')).toBe(
        'true',
      );

      await wrapper.get('.filter-drawer__actions button').trigger('click');
      expect(wrapper.emitted('update:allOpen')).toEqual([[false]]);
    });
  });

  it('parle anglais sur la page anglaise', async () => {
    const wrapper = await mountSuspended(FilterDrawer, {
      route: '/en',
      props: propsFor([], true, viewEn),
    });

    expect(wrapper.get('.filter-drawer__label').text()).toBe('main stack');
    expect(wrapper.get('.filter-drawer__actions button').text()).toBe('All techs (34)');
    expect(wrapper.get('.filter-drawer__close').text()).toBe('Close');

    await wrapper.get('.filter-drawer__actions button').trigger('click');
    expect(wrapper.get('.filter-drawer__actions button').text()).toBe('Hide the list');
    expect(wrapper.get('.all-techs__intro').text()).toContain('All my techs, by domain.');
  });
});
