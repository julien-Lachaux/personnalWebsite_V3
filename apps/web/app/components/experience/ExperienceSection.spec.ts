import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { DOMWrapper, VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useRoute } from '#imports';

import { cvEn } from '../../data/fixtures/cv.en.js';
import { cvFr } from '../../data/fixtures/cv.fr.js';
import { mapCv } from '../../data/map-cv.js';
import ExperienceSection from './ExperienceSection.vue';

const labels = {
  present: 'aujourd’hui',
  breakOrganisation: 'Projet personnel',
  workMode: (value: string) => value,
  contractType: (value: string) => value,
};
const view = mapCv(cvFr, labels);
const viewEn = mapCv(cvEn, labels);

const mounted: VueWrapper[] = [];

async function mountSection(route = '/', source = view): Promise<VueWrapper> {
  const wrapper = await mountSuspended(ExperienceSection, {
    route,
    attachTo: document.body,
    props: { experiences: source.experiences, techs: source.techs },
  });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
}

function chipLabels(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.chip-input__chip').map((chip) => chip.text());
}

function eggDialog(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[role="dialog"]');
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
});

describe('ExperienceSection : structure', () => {
  it('place le filtre dans une zone fixe, hors de la liste qui défile', async () => {
    const wrapper = await mountSection();

    const filter = wrapper.get('.experience-section__filter');
    const list = wrapper.get('.experience-section__list');
    expect(filter.find('[role="search"]').exists()).toBe(true);
    expect(list.find('[role="search"]').exists()).toBe(false);
    expect(list.findAll('article')).toHaveLength(8);
    expect(filter.find('article').exists()).toBe(false);
    const children = [...wrapper.get('.experience-section').element.children];
    expect(children.indexOf(filter.element)).toBeLessThan(children.indexOf(list.element));
  });

  it('fait de la liste une région nommée, atteignable au clavier', async () => {
    const wrapper = await mountSection();

    const list = wrapper.get('.experience-section__list');
    expect(list.attributes('role')).toBe('region');
    expect(list.attributes('tabindex')).toBe('0');
    expect(list.attributes('aria-label')).toBe('Liste des expériences');
  });

  it('expose la zone qui défile à la coquille', async () => {
    const wrapper = await mountSection();

    const exposed = wrapper.vm as unknown as { scroller: HTMLElement };
    expect(exposed.scroller).toBe(wrapper.get('.experience-section__list').element);
  });

  it('cache le fondu du bas de liste aux lecteurs d’écran', async () => {
    const wrapper = await mountSection();

    expect(wrapper.get('.experience-section__fade').attributes('aria-hidden')).toBe('true');
  });
});

describe('ExperienceSection : filtre dans l’URL', () => {
  it('lit ?tech= au chargement et filtre la liste', async () => {
    const wrapper = await mountSection('/?tech=typescript,docker');

    expect(chipLabels(wrapper)).toEqual(['TypeScript', 'Docker']);
    expect(wrapper.get('.result-groups__title').text()).toBe('Avec toutes ces technos · 2');
    expect(wrapper.findAll('.experience-section__list article')).toHaveLength(2);
  });

  it('ignore une techno inconnue de l’URL', async () => {
    const wrapper = await mountSection('/?tech=inconnue');

    expect(chipLabels(wrapper)).toEqual([]);
    expect(wrapper.findAll('.experience-section__list article')).toHaveLength(8);
  });

  it('écrit ?tech= quand on choisit une techno, et le retire quand on l’enlève', async () => {
    const wrapper = await mountSection('/');

    await wrapper.findAll('.card-stack button')[0]!.trigger('click');
    await vi.waitFor(() => expect(useRoute().query['tech']).toBe('typescript'));
    expect(chipLabels(wrapper)).toEqual(['TypeScript']);

    await wrapper.get('.chip-input__chip').trigger('click');
    await vi.waitFor(() => expect(useRoute().query['tech']).toBeUndefined());
    expect(chipLabels(wrapper)).toEqual([]);
    expect(wrapper.findAll('.experience-section__list article')).toHaveLength(8);
  });

  it('écrit aussi le choix fait au champ (Entrée sur la première suggestion)', async () => {
    const wrapper = await mountSection('/');

    await wrapper.get('input').setValue('kafka');
    await wrapper.get('input').trigger('keydown', { key: 'Enter' });

    await vi.waitFor(() => expect(useRoute().query['tech']).toBe('kafka'));
    expect(wrapper.get('.result-groups__title').text()).toBe('Avec Apache Kafka · 2');
  });
});

describe('ExperienceSection : puces des cartes', () => {
  it('bascule le filtre au clic sur une puce et remonte la liste en haut', async () => {
    const wrapper = await mountSection('/');
    const list = wrapper.get('.experience-section__list').element;
    list.scrollTop = 240;

    await wrapper.findAll('.card-stack button')[0]!.trigger('click');
    await nextTick();

    expect(list.scrollTop).toBe(0);
    expect(chipLabels(wrapper)).toEqual(['TypeScript']);
    const pressed = wrapper
      .findAll('.card-stack button[aria-pressed="true"]')
      .map((chip) => chip.text());
    expect(pressed).toEqual(['TypeScript', 'TypeScript']);
  });

  it('désactive le filtre quand on reclique la même puce', async () => {
    const wrapper = await mountSection('/?tech=typescript');

    await wrapper.get('.card-stack button[aria-pressed="true"]').trigger('click');

    expect(chipLabels(wrapper)).toEqual([]);
  });
});

describe('ExperienceSection : panneau et défilement', () => {
  it('ferme le panneau du filtre quand la liste défile', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(5_000);
    const wrapper = await mountSection('/');
    await wrapper.get('input').trigger('click');
    expect(wrapper.get('.filter-drawer').classes()).toContain('filter-drawer--open');

    now.mockReturnValue(5_600);
    await wrapper.get('.experience-section__list').trigger('scroll');

    expect(wrapper.get('.filter-drawer').classes()).not.toContain('filter-drawer--open');
  });
});

describe('ExperienceSection : easter egg', () => {
  function eggChip(wrapper: VueWrapper): DOMWrapper<Element> {
    return wrapper.findAll('.card-stack button').find((chip) => chip.text() === 'Huile de coude')!;
  }

  it('s’ouvre avec la puce « Huile de coude » sans toucher au filtre', async () => {
    const wrapper = await mountSection('/');
    expect(eggDialog()).toBeNull();

    await eggChip(wrapper).trigger('click');
    await nextTick();

    expect(eggDialog()!.getAttribute('aria-label')).toBe('Huile de coude');
    expect(chipLabels(wrapper)).toEqual([]);
    expect(useRoute().query['tech']).toBeUndefined();
  });

  it('« Retour au CV » le ferme et rend le focus à la puce, même sans focus préalable', async () => {
    const wrapper = await mountSection('/');
    const chip = eggChip(wrapper);
    await chip.trigger('click');
    await nextTick();
    expect(document.activeElement).not.toBe(chip.element);

    document.body.querySelector<HTMLButtonElement>('.egg__footer button')!.click();
    await nextTick();
    await nextTick();

    expect(eggDialog()).toBeNull();
    expect(document.activeElement).toBe(chip.element);
  });
});

describe('ExperienceSection : anglais', () => {
  it('parle anglais sur la page anglaise et lit ?tech=', async () => {
    const wrapper = await mountSection('/en?tech=kafka', viewEn);

    expect(wrapper.get('.tech-filter__label').text()).toBe('filter by tech');
    expect(wrapper.get('.experience-section__list').attributes('aria-label')).toBe(
      'List of experiences',
    );
    expect(wrapper.get('.result-groups__title').text()).toBe('With Apache Kafka · 2');
    expect(wrapper.get('.card-header__period').text()).toBe('Mar 2021 – Mar 2024');
  });
});
