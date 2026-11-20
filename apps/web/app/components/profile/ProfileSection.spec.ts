import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import { type LinksView, type ProfileView } from '../../data/cv-view.js';
import ProfileSection from './ProfileSection.vue';

const profile: ProfileView = {
  title: 'Développeur full-stack',
  titleLines: ['Développeur', 'full-stack'],
  badge: 'senior',
  taglines: ['NestJS, Vue.js : données et analytics', 'Développement assisté par IA'],
  intro: 'Depuis 2017, je conçois des API et des flux de données fiables.',
  mission: 'Je souhaite servir des structures utiles.',
  currently: 'Bénévole deux jours par semaine',
  lookingFor: {
    format: 'Temps partiel',
    location: 'Ville, Région',
    availability: 'Immédiate',
  },
  cvPath: '/cv/cv-fr.pdf',
};

const links: LinksView = {
  linkedin: { url: 'https://www.linkedin.com/in/example', label: 'LinkedIn' },
  github: { url: 'https://github.com/example', label: 'GitHub' },
  linkedinRecommendations: null,
};

describe('ProfileSection', () => {
  it('affiche titre, accroches, mission, intro, situation et réseaux dans cet ordre', async () => {
    const wrapper = await mountSuspended(ProfileSection, { props: { profile, links } });

    const order = [
      '.profile-title',
      '.profile__taglines',
      '.profile__mission',
      '.profile__intro',
      '.situation',
      '.social-links',
    ].map((selector) => wrapper.get(selector).element);
    const children = [...wrapper.get('.profile').element.children];
    expect(order.map((element) => children.indexOf(element))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('affiche les textes du profil', async () => {
    const wrapper = await mountSuspended(ProfileSection, { props: { profile, links } });

    expect(wrapper.get('.profile-title').text()).toContain('Développeur');
    expect(wrapper.get('.profile-title').text()).toContain('full-stack');
    expect(wrapper.get('.profile-title .senior-badge').text()).toBe('senior');
    expect(wrapper.findAll('.profile__tagline').map((p) => p.text())).toEqual(profile.taglines);
    expect(wrapper.get('.profile__mission').text()).toBe(profile.mission);
    expect(wrapper.get('.profile__intro').text()).toBe(profile.intro);
    expect(wrapper.get('.situation').text()).toContain(profile.currently);
    expect(wrapper.get('.situation').text()).toContain(profile.lookingFor.format);
    expect(wrapper.get('.situation').text()).toContain(profile.lookingFor.location);
    expect(wrapper.get('.situation').text()).toContain(profile.lookingFor.availability);
  });

  it('ne pose aucun h2 (celui de la section est dans la coquille) et aucun h1 par défaut', async () => {
    const wrapper = await mountSuspended(ProfileSection, { props: { profile, links } });

    expect(wrapper.find('h1').exists()).toBe(false);
    expect(wrapper.find('h2').exists()).toBe(false);
    expect(wrapper.findAll('h3')).toHaveLength(2);
  });

  it('porte le h1 de la page quand titleTag vaut h1', async () => {
    const wrapper = await mountSuspended(ProfileSection, {
      props: { profile, links, titleTag: 'h1' },
    });

    const heading = wrapper.get('h1');
    expect(heading.classes()).toContain('profile-title');
    expect(heading.text()).toContain('full-stack');
  });

  it('masque GitHub quand le lien manque, sans toucher au reste', async () => {
    const wrapper = await mountSuspended(ProfileSection, {
      props: { profile, links: { ...links, github: null } },
    });

    const hrefs = wrapper.findAll('.social-links a').map((link) => link.attributes('href'));
    expect(hrefs).toEqual([links.linkedin!.url]);
    expect(wrapper.find('.situation').exists()).toBe(true);
  });

  it('ne fait aucune hypothèse de hauteur : aucun style de hauteur ni de défilement en ligne', async () => {
    const wrapper = await mountSuspended(ProfileSection, { props: { profile, links } });

    expect(wrapper.findAll('[style]')).toHaveLength(0);
    expect(wrapper.attributes('style')).toBeUndefined();
    expect(wrapper.attributes('tabindex')).toBeUndefined();
  });

  it('suit le contenu reçu en anglais', async () => {
    const wrapper = await mountSuspended(ProfileSection, {
      route: '/en',
      props: {
        profile: {
          ...profile,
          titleLines: ['Full-stack', 'developer'],
          taglines: ['NestJS, Vue.js: data and analytics'],
        },
        links,
      },
    });

    expect(wrapper.get('.profile-title').text()).toContain('Full-stack');
    expect(wrapper.findAll('h3').map((heading) => heading.text())).toEqual([
      'right now',
      'what I’m looking for',
    ]);
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Social links');
  });
});
