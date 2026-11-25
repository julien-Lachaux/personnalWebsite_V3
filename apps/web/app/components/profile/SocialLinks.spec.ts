import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import SocialLinks from './SocialLinks.vue';

const linkedin = { url: 'https://www.linkedin.com/in/example', label: 'LinkedIn' };
const github = { url: 'https://github.com/example', label: 'GitHub' };

describe('SocialLinks', () => {
  it('rend GitHub puis LinkedIn dans une navigation nommée', async () => {
    const wrapper = await mountSuspended(SocialLinks, { props: { github, linkedin } });

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Réseaux');
    const links = wrapper.findAll('a');
    expect(links.map((link) => link.attributes('href'))).toEqual([github.url, linkedin.url]);
    expect(links[0]!.text()).toContain('GitHub');
    expect(links[1]!.text()).toContain('LinkedIn');
    expect(links[0]!.classes()).toContain('base-button--neon');
    expect(links[1]!.classes()).toContain('base-button--linkedin');
  });

  it('ouvre chaque lien dans un nouvel onglet, noopener noreferrer, et l’annonce', async () => {
    const wrapper = await mountSuspended(SocialLinks, { props: { github, linkedin } });

    for (const link of wrapper.findAll('a')) {
      expect(link.attributes('target')).toBe('_blank');
      expect(link.attributes('rel')).toBe('noopener noreferrer');
      expect(link.get('.visually-hidden').text()).toBe("(s'ouvre dans un nouvel onglet)");
    }
  });

  it('masque GitHub quand le lien manque', async () => {
    const wrapper = await mountSuspended(SocialLinks, { props: { github: null, linkedin } });

    const links = wrapper.findAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]!.attributes('href')).toBe(linkedin.url);
    expect(wrapper.text()).not.toContain('GitHub');
  });

  it('masque LinkedIn quand le lien manque', async () => {
    const wrapper = await mountSuspended(SocialLinks, { props: { github, linkedin: null } });

    const links = wrapper.findAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]!.attributes('href')).toBe(github.url);
  });

  it('ne rend rien, pas même la navigation, sans aucun lien', async () => {
    const wrapper = await mountSuspended(SocialLinks, {
      props: { github: null, linkedin: null },
    });

    expect(wrapper.find('nav').exists()).toBe(false);
    expect(wrapper.find('a').exists()).toBe(false);
  });

  it('cache les icônes aux lecteurs d’écran', async () => {
    const wrapper = await mountSuspended(SocialLinks, { props: { github, linkedin } });

    const icons = wrapper.findAll('svg');
    expect(icons).toHaveLength(2);
    for (const icon of icons) {
      expect(icon.element.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('parle anglais sur la page anglaise', async () => {
    const wrapper = await mountSuspended(SocialLinks, {
      route: '/en',
      props: { github, linkedin },
    });

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Social links');
    expect(wrapper.get('.visually-hidden').text()).toBe('(opens in a new tab)');
  });
});
