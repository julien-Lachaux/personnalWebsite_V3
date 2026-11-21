import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { cvEn } from '../../data/fixtures/cv.en.js';
import { cvFr } from '../../data/fixtures/cv.fr.js';
import { mapCv } from '../../data/map-cv.js';
import TechFilter from './TechFilter.vue';

const labels = {
  present: 'aujourd’hui',
  breakOrganisation: 'Projet personnel',
  workMode: (value: string) => value,
  contractType: (value: string) => value,
};
const view = mapCv(cvFr, labels);
const viewEn = mapCv(cvEn, labels);

const mounted: VueWrapper[] = [];

async function mountFilter(
  selected: string[] = [],
  route = '/',
  source = view,
): Promise<VueWrapper> {
  const wrapper: VueWrapper = await mountSuspended(TechFilter, {
    route,
    attachTo: document.body,
    props: {
      techs: source.techs,
      experiences: source.experiences,
      selected,
      'onUpdate:selected': (next: readonly string[]) => wrapper.setProps({ selected: next }),
    },
  });
  mounted.push(wrapper);
  return wrapper;
}

function lastSelection(wrapper: VueWrapper): unknown {
  return wrapper.emitted('update:selected')?.at(-1)?.[0];
}

function isOpen(wrapper: VueWrapper): boolean {
  return wrapper.get('.filter-drawer').classes().includes('filter-drawer--open');
}

function pressEscape(target: Element): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
});

describe('TechFilter : structure', () => {
  it('a une étiquette, une zone de recherche nommée et un champ nommé par l’étiquette', async () => {
    const wrapper = await mountFilter();

    const label = wrapper.get('.tech-filter__label');
    expect(label.text()).toBe('filtrer par techno');
    const search = wrapper.get('[role="search"]');
    expect(search.attributes('aria-label')).toBe('Filtrer les expériences');
    const input = wrapper.get('input');
    expect(input.attributes('aria-labelledby')).toBe(label.attributes('id'));
    expect(input.attributes('placeholder')).toBe('Ex. Kafka, Docker… (34 technos)');
  });

  it('propose d’ajouter une techno quand des filtres sont déjà choisis', async () => {
    const wrapper = await mountFilter(['kafka']);

    expect(wrapper.get('input').attributes('placeholder')).toBe('Ajouter une techno…');
    expect(wrapper.get('.chip-input__chip').attributes('aria-label')).toBe(
      'Retirer le filtre Apache Kafka',
    );
  });

  it('montre le panneau fermé (inerte) au départ et le champ le pilote', async () => {
    const wrapper = await mountFilter();

    expect(isOpen(wrapper)).toBe(false);
    expect(wrapper.get('.filter-drawer').attributes('inert')).toBeDefined();
    expect(wrapper.get('input').attributes('aria-controls')).toBe(
      wrapper.get('.filter-drawer').attributes('id'),
    );
  });
});

describe('TechFilter : ouverture et fermeture du panneau', () => {
  it('s’ouvre au focus du champ', async () => {
    const wrapper = await mountFilter();

    wrapper.get('input').element.focus();
    await wrapper.vm.$nextTick();

    expect(isOpen(wrapper)).toBe(true);
    expect(wrapper.get('.filter-drawer').attributes('inert')).toBeUndefined();
  });

  it('s’ouvre au clic sur le champ', async () => {
    const wrapper = await mountFilter();

    await wrapper.get('input').trigger('click');

    expect(isOpen(wrapper)).toBe(true);
  });

  it('ne se ferme pas quand on choisit une techno, et l’émet', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').trigger('click');

    const kafka = wrapper
      .findAll('.filter-drawer__quick button')
      .find((button) => button.text().startsWith('Apache Kafka'))!;
    await kafka.trigger('click');

    expect(lastSelection(wrapper)).toEqual(['kafka']);
    expect(isOpen(wrapper)).toBe(true);
    await wrapper.findAll('.filter-drawer__quick button')[5]!.trigger('click');
    expect(lastSelection(wrapper)).toEqual([]);
  });

  it('se ferme par « Fermer » et rend le focus au champ sans le rouvrir', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').trigger('click');

    await wrapper.get('.filter-drawer__close').trigger('click');

    expect(isOpen(wrapper)).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('input').element);
  });

  it('se ferme par Échap quand le champ est vide, et rend le focus au champ sans le rouvrir', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').trigger('click');

    const event = pressEscape(wrapper.get('input').element);
    await wrapper.vm.$nextTick();

    expect(event.defaultPrevented).toBe(true);
    expect(isOpen(wrapper)).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('input').element);
  });

  it('se ferme par Échap depuis le panneau lui-même', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').trigger('click');
    const chip = wrapper.get('.filter-drawer__quick button');
    (chip.element as HTMLElement).focus();

    pressEscape(chip.element);
    await wrapper.vm.$nextTick();

    expect(isOpen(wrapper)).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('input').element);
  });

  it('n’intercepte pas Échap quand rien n’est ouvert ni saisi', async () => {
    const wrapper = await mountFilter();

    const event = pressEscape(wrapper.get('input').element);

    expect(event.defaultPrevented).toBe(false);
  });

  it('ignore les autres touches', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').trigger('click');

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    wrapper.get('input').element.dispatchEvent(event);

    expect(isOpen(wrapper)).toBe(true);
  });

  it('se ferme au défilement de la liste, sauf juste après l’ouverture', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(10_000);
    const wrapper = await mountFilter();
    await wrapper.get('input').trigger('click');
    const exposed = wrapper.vm as unknown as { closeOnScroll: () => void };

    now.mockReturnValue(10_300);
    exposed.closeOnScroll();
    await wrapper.vm.$nextTick();
    expect(isOpen(wrapper)).toBe(true);

    now.mockReturnValue(10_451);
    exposed.closeOnScroll();
    await wrapper.vm.$nextTick();
    expect(isOpen(wrapper)).toBe(false);

    // Déjà fermé : sans effet.
    exposed.closeOnScroll();
    expect(isOpen(wrapper)).toBe(false);
  });

  it('ne relance pas le délai de grâce quand un clic suit le focus (panneau déjà ouvert)', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(10_000);
    const wrapper = await mountFilter();
    wrapper.get('input').element.focus();
    await wrapper.vm.$nextTick();
    now.mockReturnValue(10_400);
    await wrapper.get('input').trigger('click');

    now.mockReturnValue(10_460);
    (wrapper.vm as unknown as { closeOnScroll: () => void }).closeOnScroll();
    await wrapper.vm.$nextTick();

    expect(isOpen(wrapper)).toBe(false);
  });

  it('retire son écouteur de clavier au démontage', async () => {
    const wrapper = await mountFilter();
    const search = wrapper.get('[role="search"]').element;
    const remove = vi.spyOn(search, 'removeEventListener');

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});

describe('TechFilter : puces et clavier', () => {
  it('retire une puce au clic et rend le focus au champ sans ouvrir le panneau', async () => {
    const wrapper = await mountFilter(['kafka', 'docker']);

    await wrapper.findAll('.chip-input__chip')[0]!.trigger('click');

    expect(lastSelection(wrapper)).toEqual(['docker']);
    expect(wrapper.findAll('.chip-input__chip')).toHaveLength(1);
    expect(document.activeElement).toBe(wrapper.get('input').element);
    expect(isOpen(wrapper)).toBe(false);
  });

  it('retire la dernière puce avec Retour arrière sur un champ vide', async () => {
    const wrapper = await mountFilter(['kafka', 'docker']);

    await wrapper.get('input').trigger('keydown', { key: 'Backspace' });

    expect(lastSelection(wrapper)).toEqual(['kafka']);
  });

  it('« Effacer » retire tous les filtres, vide la saisie et rend le focus au champ', async () => {
    const wrapper = await mountFilter(['kafka', 'docker']);

    await wrapper.get('.chip-input .base-button').trigger('click');

    expect(lastSelection(wrapper)).toEqual([]);
    expect(wrapper.findAll('.chip-input__chip')).toHaveLength(0);
    expect(document.activeElement).toBe(wrapper.get('input').element);
    expect(isOpen(wrapper)).toBe(false);
  });
});

describe('TechFilter : saisie et suggestions', () => {
  it('remplace le panneau par les suggestions (6 au plus) et pilote la liste', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').trigger('click');

    await wrapper.get('input').setValue('a');

    const suggestions = wrapper.get('.suggestions');
    expect(suggestions.findAll('button').length).toBeLessThanOrEqual(6);
    expect(suggestions.findAll('button').length).toBeGreaterThan(0);
    expect(wrapper.get('input').attributes('aria-controls')).toBe(suggestions.attributes('id'));
    expect(wrapper.get('.filter-drawer').attributes('inert')).toBeDefined();
  });

  it('limite les suggestions à six', async () => {
    const wrapper = await mountFilter();

    await wrapper.get('input').setValue('e');

    expect(wrapper.get('.suggestions').findAll('button')).toHaveLength(6);
  });

  it('Entrée choisit la première suggestion valide, vide la saisie et rend le focus au champ', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').setValue('kafka');

    await wrapper.get('input').trigger('keydown', { key: 'Enter' });

    expect(lastSelection(wrapper)).toEqual(['kafka']);
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
    expect(wrapper.find('.suggestions').exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('input').element);
    expect(isOpen(wrapper)).toBe(false);
  });

  it('Entrée saute une suggestion à 0 résultat et prend la première valide', async () => {
    const wrapper = await mountFilter(['typescript', 'docker']);
    await wrapper.get('input').setValue('s');

    const [first] = wrapper.get('.suggestions').findAll('button');
    expect(first!.attributes('aria-disabled')).toBe('true');
    await wrapper.get('input').trigger('keydown', { key: 'Enter' });

    const picked = lastSelection(wrapper) as string[];
    expect(picked.slice(0, 2)).toEqual(['typescript', 'docker']);
    expect(picked).toHaveLength(3);
  });

  it('Entrée sans suggestion valide ne fait rien', async () => {
    const wrapper = await mountFilter(['typescript', 'docker']);
    await wrapper.get('input').setValue('node');

    await wrapper.get('input').trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('update:selected')).toBeUndefined();
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('node');
  });

  it('un clic sur une suggestion l’ajoute et rend le focus au champ', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').setValue('redis');

    await wrapper.get('.suggestions button').trigger('click');

    expect(lastSelection(wrapper)).toEqual(['redis']);
    expect(document.activeElement).toBe(wrapper.get('input').element);
  });

  it('Échap vide d’abord la saisie, puis ferme le panneau au second appui', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').trigger('click');
    await wrapper.get('input').setValue('kaf');

    const first = pressEscape(wrapper.get('input').element);
    await wrapper.vm.$nextTick();

    expect(first.defaultPrevented).toBe(true);
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
    expect(wrapper.find('.suggestions').exists()).toBe(false);
    expect(isOpen(wrapper)).toBe(true);
    expect(document.activeElement).toBe(wrapper.get('input').element);

    pressEscape(wrapper.get('input').element);
    await wrapper.vm.$nextTick();
    expect(isOpen(wrapper)).toBe(false);
  });

  it('sans correspondance, « Voir toutes les technos » ouvre le panneau avec toutes les technos', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').setValue('zzz');
    expect(wrapper.get('.suggestions__none').text()).toContain(
      'Aucune techno ne correspond à « zzz ».',
    );

    await wrapper.get('.suggestions__none button').trigger('click');

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
    expect(wrapper.find('.suggestions').exists()).toBe(false);
    expect(isOpen(wrapper)).toBe(true);
    expect(wrapper.find('.all-techs').exists()).toBe(true);
  });

  it('garde « Toutes les technos » déplié après une fermeture', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').trigger('click');
    await wrapper.get('.filter-drawer__actions button').trigger('click');
    await wrapper.get('.filter-drawer__close').trigger('click');
    await wrapper.get('input').trigger('click');

    expect(wrapper.find('.all-techs').exists()).toBe(true);
  });
});

describe('TechFilter : annonce aux lecteurs d’écran', () => {
  function live(wrapper: VueWrapper): string {
    return wrapper.get('[aria-live="polite"]').text();
  }

  it('annonce le nombre d’expériences affichées sans filtre', async () => {
    const wrapper = await mountFilter();

    expect(live(wrapper)).toBe('8 expériences affichées');
    expect(wrapper.get('[aria-live]').classes()).toContain('visually-hidden');
  });

  it('annonce le nombre de résultats (pluriel et singulier) et l’absence de résultat', async () => {
    expect(live(await mountFilter(['kafka']))).toBe(
      '2 expériences avec toutes les technos choisies',
    );
    expect(live(await mountFilter(['nodejs']))).toBe(
      '1 expérience avec toutes les technos choisies',
    );
    expect(live(await mountFilter(['typescript', 'php']))).toBe(
      'Aucune expérience ne combine toutes ces technos',
    );
  });

  it('met la région à jour quand le filtre change', async () => {
    const wrapper = await mountFilter();
    await wrapper.get('input').setValue('nodejs');
    await wrapper.get('input').setValue('node');

    await wrapper.get('input').trigger('keydown', { key: 'Enter' });

    expect(live(wrapper)).toBe('1 expérience avec toutes les technos choisies');
  });
});

describe('TechFilter : anglais', () => {
  it('parle anglais sur la page anglaise', async () => {
    const wrapper = await mountFilter([], '/en', viewEn);

    expect(wrapper.get('.tech-filter__label').text()).toBe('filter by tech');
    expect(wrapper.get('[role="search"]').attributes('aria-label')).toBe('Filter experiences');
    expect(wrapper.get('input').attributes('placeholder')).toBe('E.g. Kafka, Docker… (34 techs)');
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('8 experiences shown');

    await wrapper.get('input').setValue('typescript');
    await wrapper.get('input').trigger('keydown', { key: 'Enter' });
    expect(wrapper.get('[aria-live="polite"]').text()).toBe(
      '2 experiences with all the chosen techs',
    );

    const empty = await mountFilter(['typescript', 'php'], '/en', viewEn);
    expect(empty.get('[aria-live="polite"]').text()).toBe('No experience combines all these techs');
  });
});
