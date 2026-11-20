import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRuntimeConfig } from '#imports';

import ContactButton from './ContactButton.vue';

// Adresse de test : un placeholder, jamais une vraie adresse (SPEC § 11).
const PLACEHOLDER = 'contact@example.org';

let original = '';

function setEmail(email: string): void {
  useRuntimeConfig().public.contactEmail = email;
}

beforeEach(() => {
  original = useRuntimeConfig().public.contactEmail;
  setEmail(PLACEHOLDER);
});

afterEach(() => {
  setEmail(original);
});

describe('ContactButton', () => {
  it('est un lien mailto: vers l’adresse configurée, avec le sujet prérempli (français)', async () => {
    const wrapper = await mountSuspended(ContactButton, { route: '/' });

    const link = wrapper.get('a');
    expect(link.attributes('href')).toBe(
      `mailto:${PLACEHOLDER}?subject=${encodeURIComponent('Prise de contact depuis votre site')}`,
    );
    expect(link.text()).toBe('Lancer l’entretien');
  });

  it('parle anglais sur la page anglaise', async () => {
    const wrapper = await mountSuspended(ContactButton, { route: '/en' });

    const link = wrapper.get('a');
    expect(link.text()).toBe('Start the interview');
    expect(link.attributes('href')).toContain(
      `subject=${encodeURIComponent('Getting in touch from your website')}`,
    );
  });

  it('n’ouvre pas d’onglet : ce n’est pas un lien externe', async () => {
    const wrapper = await mountSuspended(ContactButton, { route: '/' });

    const link = wrapper.get('a');
    expect(link.attributes('target')).toBeUndefined();
    expect(link.attributes('rel')).toBeUndefined();
  });

  it('est un bouton plein (accent) de 40 px par défaut', async () => {
    const wrapper = await mountSuspended(ContactButton, { route: '/' });

    expect(wrapper.get('a').classes()).toEqual(
      expect.arrayContaining(['base-button--solid', 'base-button--sm']),
    );
  });

  it('prend la taille demandée et la classe reçue', async () => {
    const wrapper = await mountSuspended(ContactButton, {
      route: '/',
      props: { size: 'md' },
      attrs: { class: 'dans-une-barre' },
    });

    expect(wrapper.get('a').classes()).toEqual(
      expect.arrayContaining(['base-button--md', 'dans-une-barre']),
    );
    expect(wrapper.get('a').classes()).not.toContain('base-button--sm');
  });

  it('n’est pas rendu tant que l’adresse n’est pas configurée', async () => {
    setEmail('');

    const wrapper = await mountSuspended(ContactButton, { route: '/' });

    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  it('n’est pas rendu pour une adresse qui n’a pas une forme admise', async () => {
    setEmail('a@b.org?bcc=x@y.org');

    const wrapper = await mountSuspended(ContactButton, { route: '/' });

    expect(wrapper.find('a').exists()).toBe(false);
  });
});
