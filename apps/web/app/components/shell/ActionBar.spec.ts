import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRuntimeConfig } from '#imports';

import ActionBar from './ActionBar.vue';

// Adresse de test : un placeholder, jamais une vraie adresse (SPEC § 11).
const PLACEHOLDER = 'contact@example.org';
const MAILTO = `mailto:${PLACEHOLDER}?subject=${encodeURIComponent('Prise de contact depuis votre site')}`;

let original = '';

beforeEach(() => {
  original = useRuntimeConfig().public.contactEmail;
  useRuntimeConfig().public.contactEmail = PLACEHOLDER;
});

afterEach(() => {
  useRuntimeConfig().public.contactEmail = original;
});

describe('ActionBar', () => {
  it('propose Lancer l’entretien (mailto:) puis CV PDF, en boutons de 48 px', async () => {
    const wrapper = await mountSuspended(ActionBar, {
      route: '/',
      props: { hidden: false, cvPath: '/cv/exemple.pdf' },
    });

    const contact = wrapper.get('a.base-button');
    const cv = wrapper.get('button');
    expect(contact.text()).toBe('Lancer l’entretien');
    expect(contact.attributes('href')).toBe(MAILTO);
    expect(contact.classes()).toContain('base-button--md');
    expect(cv.text()).toBe('CV PDF');
    expect(cv.attributes('aria-expanded')).toBe('false');
    expect(cv.classes()).toContain('base-button--md');
  });

  it('est affichée et atteignable quand elle n’est pas masquée', async () => {
    const wrapper = await mountSuspended(ActionBar, {
      route: '/',
      props: { hidden: false, cvPath: '/cv/exemple.pdf' },
    });

    const root = wrapper.get('.action-bar');
    expect(root.classes()).not.toContain('action-bar--hidden');
    expect(root.attributes('inert')).toBeUndefined();
  });

  it('est repliée et inerte (plus de focus dans ses boutons) quand elle est masquée', async () => {
    const wrapper = await mountSuspended(ActionBar, {
      route: '/',
      props: { hidden: true, cvPath: '/cv/exemple.pdf' },
    });

    const root = wrapper.get('.action-bar');
    expect(root.classes()).toContain('action-bar--hidden');
    expect(root.attributes('inert')).toBeDefined();
  });

  it('se replie puis revient quand `hidden` change', async () => {
    const wrapper = await mountSuspended(ActionBar, {
      route: '/',
      props: { hidden: false, cvPath: '/cv/exemple.pdf' },
    });

    await wrapper.setProps({ hidden: true });
    expect(wrapper.get('.action-bar').classes()).toContain('action-bar--hidden');
    expect(wrapper.get('.action-bar').attributes('inert')).toBeDefined();

    await wrapper.setProps({ hidden: false });
    expect(wrapper.get('.action-bar').classes()).not.toContain('action-bar--hidden');
    expect(wrapper.get('.action-bar').attributes('inert')).toBeUndefined();
  });

  it('traduit les boutons en anglais', async () => {
    const wrapper = await mountSuspended(ActionBar, {
      route: '/en',
      props: { hidden: false, cvPath: '/cv/exemple.pdf' },
    });

    expect(wrapper.findAll('a.base-button, button').map((control) => control.text())).toEqual([
      'Start the interview',
      'CV PDF',
    ]);
  });

  it('garde CV PDF seul tant que l’adresse de contact n’est pas configurée', async () => {
    useRuntimeConfig().public.contactEmail = '';

    const wrapper = await mountSuspended(ActionBar, {
      route: '/',
      props: { hidden: false, cvPath: '/cv/exemple.pdf' },
    });

    expect(wrapper.findAll('a.base-button, button').map((control) => control.text())).toEqual([
      'CV PDF',
    ]);
  });
});
