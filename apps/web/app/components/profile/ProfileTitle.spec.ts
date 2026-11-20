import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import ProfileTitle from './ProfileTitle.vue';

describe('ProfileTitle', () => {
  it('affiche la première ligne en gras, la seconde en accent et la pastille', async () => {
    const wrapper = await mountSuspended(ProfileTitle, {
      props: { lines: ['Développeur', 'full-stack'], badge: 'senior' },
    });

    expect(wrapper.get('.profile-title__first').text()).toBe('Développeur');
    expect(wrapper.get('.profile-title__accent').text()).toBe('full-stack');
    expect(wrapper.get('.senior-badge').text()).toBe('senior');
    expect(
      wrapper.get('.profile-title__second').element.contains(wrapper.get('.senior-badge').element),
    ).toBe(true);
  });

  it('est un div par défaut : la coquille pose déjà le h1', async () => {
    const wrapper = await mountSuspended(ProfileTitle, {
      props: { lines: ['Développeur', 'full-stack'], badge: 'senior' },
    });

    expect(wrapper.find('div.profile-title').exists()).toBe(true);
    expect(wrapper.find('h1').exists()).toBe(false);
  });

  it('devient le h1 de la page quand l’appelant le demande', async () => {
    const wrapper = await mountSuspended(ProfileTitle, {
      props: { lines: ['Développeur', 'full-stack'], badge: 'senior', tag: 'h1' },
    });

    expect(wrapper.find('h1.profile-title').exists()).toBe(true);
    expect(wrapper.text()).toContain('Développeur');
    expect(wrapper.text()).toContain('full-stack');
    expect(wrapper.text()).toContain('senior');
  });

  it('garde la pastille seule sur la seconde ligne quand le titre n’a qu’un mot', async () => {
    const wrapper = await mountSuspended(ProfileTitle, {
      props: { lines: ['Développeur'], badge: 'senior' },
    });

    expect(wrapper.get('.profile-title__first').text()).toBe('Développeur');
    expect(wrapper.find('.profile-title__accent').exists()).toBe(false);
    expect(wrapper.get('.senior-badge').text()).toBe('senior');
  });

  it('n’affiche pas de pastille quand le texte est vide', async () => {
    const wrapper = await mountSuspended(ProfileTitle, {
      props: { lines: ['Développeur', 'full-stack'], badge: '' },
    });

    expect(wrapper.find('.senior-badge').exists()).toBe(false);
    expect(wrapper.get('.profile-title__accent').text()).toBe('full-stack');
  });

  it('affiche le texte reçu tel quel (anglais)', async () => {
    const wrapper = await mountSuspended(ProfileTitle, {
      route: '/en',
      props: { lines: ['Full-stack', 'developer'], badge: 'senior' },
    });

    expect(wrapper.get('.profile-title__first').text()).toBe('Full-stack');
    expect(wrapper.get('.profile-title__accent').text()).toBe('developer');
  });
});
