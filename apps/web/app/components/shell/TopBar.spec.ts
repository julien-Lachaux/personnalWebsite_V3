import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRuntimeConfig } from '#imports';

import type { SectionId } from '../../composables/shell/sections.js';
import TopBar from './TopBar.vue';

// Adresse de test : un placeholder, jamais une vraie adresse (SPEC § 11).
const PLACEHOLDER = 'contact@example.org';
const MAILTO = `mailto:${PLACEHOLDER}?subject=${encodeURIComponent('Prise de contact depuis votre site')}`;

let original = '';

async function mountBar(active: SectionId | null, route = '/'): Promise<VueWrapper> {
  return mountSuspended(TopBar, {
    route,
    props: { active, cvPath: '/cv/exemple.pdf', declarationUrl: '/accessibilite' },
  });
}

beforeEach(() => {
  original = useRuntimeConfig().public.contactEmail;
  useRuntimeConfig().public.contactEmail = PLACEHOLDER;
});

afterEach(() => {
  useRuntimeConfig().public.contactEmail = original;
});

describe('TopBar : structure', () => {
  it('est l’en-tête de la page, avec le nom du site (l’invite >_ est décorative)', async () => {
    const wrapper = await mountBar(null);

    expect(wrapper.get('header').element.tagName).toBe('HEADER');
    const brand = wrapper.get('.top-bar__brand');
    expect(brand.get('[aria-hidden="true"]').text()).toBe('>_');
    expect(brand.text()).toBe('>_ julien-lachaux');
  });

  it('contient la navigation « Sections » : vue d’ensemble puis Profil, XP, Recos, IA', async () => {
    const wrapper = await mountBar(null);

    const nav = wrapper.get('nav');
    expect(nav.attributes('aria-label')).toBe('Sections');
    const buttons = nav.findAll('button');
    expect(buttons).toHaveLength(5);
    expect(buttons[0]!.attributes('aria-label')).toBe('Vue d’ensemble');
    expect(buttons.slice(1).map((button) => button.text())).toEqual([
      'Profil',
      'XP',
      'Recos',
      'IA',
    ]);
    expect(buttons.every((button) => button.attributes('type') === 'button')).toBe(true);
  });

  it('a une icône décorative pour la vue d’ensemble, nommée par le bouton', async () => {
    const wrapper = await mountBar(null);

    const overview = wrapper.get('nav button');
    expect(overview.get('svg').attributes('aria-hidden')).toBe('true');
    expect(overview.text()).toBe('');
  });

  it('propose les deux actions : Lancer l’entretien (mailto:) et CV PDF', async () => {
    const wrapper = await mountBar(null);

    const actions = wrapper.get('.top-bar__actions');
    const [contact, cv] = actions.findAll('a');
    expect(contact!.attributes('href')).toBe(MAILTO);
    expect(contact!.text()).toBe('Lancer l’entretien');
    expect(cv!.attributes('href')).toBe('/cv/exemple.pdf');
    expect(cv!.text()).toBe('CV PDF');
  });

  it('range nom, navigation, actions puis accessibilité, langue et thème', async () => {
    const wrapper = await mountBar(null);

    const order = [
      wrapper.get('.top-bar__brand').element,
      wrapper.get('nav').element,
      wrapper.get('.top-bar__actions').element,
      wrapper.get('button[aria-haspopup="dialog"]').element,
      wrapper.get('a[hreflang]').element,
      wrapper.get('button[aria-label^="Thème"]').element,
    ];
    for (let index = 1; index < order.length; index += 1) {
      expect(
        order[index - 1]!.compareDocumentPosition(order[index]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('transmet l’adresse de la déclaration au panneau d’accessibilité', async () => {
    const wrapper = await mountBar(null);

    expect(wrapper.get('a.a11y-panel__link').attributes('href')).toBe('/accessibilite');
  });

  it('n’affiche pas « Lancer l’entretien » tant que l’adresse n’est pas configurée', async () => {
    useRuntimeConfig().public.contactEmail = '';

    const wrapper = await mountBar(null);

    expect(
      wrapper
        .get('.top-bar__actions')
        .findAll('a')
        .map((link) => link.text()),
    ).toEqual(['CV PDF']);
  });
});

describe('TopBar : section courante', () => {
  it('marque la vue d’ensemble quand aucune section n’est agrandie, et elle seule', async () => {
    const wrapper = await mountBar(null);

    const current = wrapper.findAll('nav [aria-current]');
    expect(current).toHaveLength(1);
    expect(current[0]!.attributes('aria-current')).toBe('true');
    expect(current[0]!.attributes('aria-label')).toBe('Vue d’ensemble');
  });

  it.each([
    ['profile', 'Profil'],
    ['experience', 'XP'],
    ['recommendations', 'Recos'],
    ['ai', 'IA'],
  ] as const)('marque l’onglet %s et lui seul', async (id, label) => {
    const wrapper = await mountBar(id);

    const current = wrapper.findAll('nav [aria-current]');
    expect(current.map((button) => button.text())).toEqual([label]);
    expect(current[0]!.attributes('aria-current')).toBe('true');
  });
});

describe('TopBar : événements', () => {
  it('émet select avec l’identifiant de la section cliquée', async () => {
    const wrapper = await mountBar(null);

    const tabs = wrapper.findAll('nav button').slice(1);
    for (const tab of tabs) await tab.trigger('click');

    expect(wrapper.emitted('select')).toEqual([
      ['profile'],
      ['experience'],
      ['recommendations'],
      ['ai'],
    ]);
    expect(wrapper.emitted('overview')).toBeUndefined();
  });

  it('émet overview au clic sur la vue d’ensemble', async () => {
    const wrapper = await mountBar('ai');

    await wrapper.get('nav button').trigger('click');

    expect(wrapper.emitted('overview')).toEqual([[]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });
});

describe('TopBar : anglais', () => {
  it('traduit la navigation et les actions', async () => {
    const wrapper = await mountBar('experience', '/en');

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Sections');
    expect(wrapper.get('nav button').attributes('aria-label')).toBe('Overview');
    expect(
      wrapper
        .findAll('nav button')
        .slice(1)
        .map((button) => button.text()),
    ).toEqual(['Profile', 'XP', 'Recs', 'AI']);
    expect(
      wrapper
        .get('.top-bar__actions')
        .findAll('a')
        .map((link) => link.text()),
    ).toEqual(['Start the interview', 'CV PDF']);
  });
});
