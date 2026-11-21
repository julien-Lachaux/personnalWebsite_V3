import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import { cvEn } from '../../data/fixtures/cv.en.js';
import { cvFr } from '../../data/fixtures/cv.fr.js';
import { mapCv } from '../../data/map-cv.js';
import { techCounter, type TechCounter } from '../../domain/filter.js';
import TechOption from './TechOption.vue';

const labels = {
  present: 'aujourd’hui',
  breakOrganisation: 'Projet personnel',
  workMode: (value: string) => value,
  contractType: (value: string) => value,
};
const view = mapCv(cvFr, labels);
const viewEn = mapCv(cvEn, labels);

function tech(slug: string, source = view) {
  return source.techs.all.find((item) => item.slug === slug)!;
}

function counter(slug: string, selected: string[] = [], source = view): TechCounter {
  return techCounter(source.experiences, selected, slug);
}

describe('TechOption', () => {
  it('est un bouton avec compteur dont le nom commence par le nom de la techno (disponible)', async () => {
    const wrapper = await mountSuspended(TechOption, {
      route: '/',
      props: { tech: tech('nestjs'), counter: counter('nestjs') },
    });

    const button = wrapper.get('button');
    expect(button.element.textContent.trim()).toBe('NestJS 1');
    expect(button.attributes('aria-label')).toBe('NestJS, 1 expérience');
    expect(button.attributes('aria-pressed')).toBe('false');
    expect(button.attributes('aria-disabled')).toBeUndefined();
    expect(button.classes()).toContain('tech-chip--md');
  });

  it('reprend le texte visible (nom et compteur) dans le nom accessible (WCAG 2.5.3)', async () => {
    const normalize = (text: string): string =>
      text
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .toLowerCase();
    for (const [slug, selected] of [
      ['typescript', []],
      ['nestjs', []],
      ['nodejs', ['typescript', 'docker']],
      ['typescript', ['typescript', 'docker']],
    ] as const) {
      const wrapper = await mountSuspended(TechOption, {
        route: '/',
        props: { tech: tech(slug), counter: counter(slug, [...selected]) },
      });

      const button = wrapper.get('button');
      expect(normalize(button.attributes('aria-label')!)).toContain(
        normalize(button.element.textContent),
      );
    }
  });

  it('met le pluriel dans le nom quand plusieurs expériences restent', async () => {
    const wrapper = await mountSuspended(TechOption, {
      route: '/',
      props: { tech: tech('typescript'), counter: counter('typescript') },
    });

    expect(wrapper.get('button').attributes('aria-label')).toBe('TypeScript, 2 expériences');
  });

  it('est enfoncée (aria-pressed) quand la techno est choisie, avec le résultat courant', async () => {
    const wrapper = await mountSuspended(TechOption, {
      route: '/',
      props: {
        tech: tech('typescript'),
        counter: counter('typescript', ['typescript', 'docker']),
      },
    });

    const button = wrapper.get('button');
    expect(button.attributes('aria-pressed')).toBe('true');
    expect(button.get('.tech-option__count').text()).toBe('2');
  });

  it('émet toggle avec le slug au clic', async () => {
    const wrapper = await mountSuspended(TechOption, {
      route: '/',
      props: { tech: tech('kafka'), counter: counter('kafka') },
    });

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('toggle')).toEqual([['kafka']]);
  });

  it('est atténuée et désactivée (aria-disabled, focus gardé) quand elle donnerait 0 résultat', async () => {
    const wrapper = await mountSuspended(TechOption, {
      route: '/',
      props: {
        tech: tech('nodejs'),
        counter: counter('nodejs', ['typescript', 'docker']),
      },
    });

    const button = wrapper.get('button');
    expect(button.attributes('aria-disabled')).toBe('true');
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.attributes('aria-label')).toBe('Node.js, 0 expérience avec les filtres en cours');
    expect(button.get('.tech-option__count').text()).toBe('0');

    await button.trigger('click');
    expect(wrapper.emitted('toggle')).toBeUndefined();
  });

  it('est une étiquette en pointillé non cliquable quand aucune expérience ne la porte', async () => {
    const wrapper = await mountSuspended(TechOption, {
      route: '/',
      props: { tech: tech('ai-features'), counter: counter('ai-features') },
    });

    expect(wrapper.find('button').exists()).toBe(false);
    const chip = wrapper.get('.tech-chip--dashed');
    expect(chip.element.tagName).toBe('SPAN');
    expect(chip.text()).toContain(tech('ai-features').name);
    expect(chip.get('.visually-hidden').text()).toBe('(pas d’expérience détaillée)');

    await chip.trigger('click');
    expect(wrapper.emitted('toggle')).toBeUndefined();
  });

  it('parle anglais sur la page anglaise', async () => {
    const english = await mountSuspended(TechOption, {
      route: '/en',
      props: { tech: tech('typescript', viewEn), counter: counter('typescript', [], viewEn) },
    });
    expect(english.get('button').attributes('aria-label')).toBe('TypeScript, 2 experiences');

    const disabled = await mountSuspended(TechOption, {
      route: '/en',
      props: {
        tech: tech('nodejs', viewEn),
        counter: counter('nodejs', ['typescript', 'docker'], viewEn),
      },
    });
    expect(disabled.get('button').attributes('aria-label')).toBe(
      'Node.js, 0 experiences with the current filters',
    );

    const unlinked = await mountSuspended(TechOption, {
      route: '/en',
      props: { tech: tech('ai-features', viewEn), counter: counter('ai-features', [], viewEn) },
    });
    expect(unlinked.get('.visually-hidden').text()).toBe('(no detailed experience)');
  });
});
