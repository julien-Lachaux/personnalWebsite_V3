import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtData, clearNuxtState, useRuntimeConfig } from '#imports';

import { UNINDEXED_PATH_STATE_KEY } from '../composables/seo/useSeo.js';
import { cvEn } from '../data/fixtures/cv.en.js';
import { cvFr } from '../data/fixtures/cv.fr.js';
import WorkInProgressPage from './travaux.vue';

// Page « travaux en cours » (lot 31) : message, contact par le mailto de la configuration, profil
// LinkedIn lu dans le CV (fixtures de l'application de test), hors index, dans les deux langues.

async function flushHead(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function meta(selector: string): string | null {
  return document.head.querySelector(`meta[${selector}]`)?.getAttribute('content') ?? null;
}

const mounted: VueWrapper[] = [];
let saved: string;

beforeEach(() => {
  saved = useRuntimeConfig().public.contactEmail;
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  useRuntimeConfig().public.contactEmail = saved;
  clearNuxtState(UNINDEXED_PATH_STATE_KEY);
  clearNuxtData();
});

async function mount(route: string): Promise<VueWrapper> {
  const wrapper = await mountSuspended(WorkInProgressPage, { route });
  mounted.push(wrapper);
  await flushHead();
  return wrapper;
}

describe('page « travaux en cours »', () => {
  it('en français : fenêtre `>_ travaux-en-cours.md`, titre, message, sans retour à l’accueil', async () => {
    const wrapper = await mount('/travaux');

    expect(wrapper.get('main').attributes('id')).toBe('contenu');
    expect(wrapper.get('.annex-page__bar').text()).toBe('>_ travaux-en-cours.md');
    expect(wrapper.findAll('h1').map((heading) => heading.text())).toEqual([
      'Site en cours de construction',
    ]);
    expect(wrapper.findAll('main p:not(.annex-page__bar)').map((p) => p.text())).toEqual([
      'Je reconstruis ce site de fond en comble. Il revient bientôt, avec mon parcours, mes expériences et les technologies que j’utilise.',
      'En attendant, vous pouvez m’écrire ou me retrouver sur LinkedIn.',
    ]);
    expect(wrapper.find('.annex-page__back').exists()).toBe(false);
  });

  it('en français : contact par mailto (adresse non affichée), puis le profil LinkedIn du CV', async () => {
    const wrapper = await mount('/travaux');

    const links = wrapper.findAll('main a');
    expect(links.map((link) => [link.text(), link.attributes('href')])).toEqual([
      [
        'Lancer l’entretien',
        `mailto:contact@example.org?subject=${encodeURIComponent('Prise de contact depuis votre site')}`,
      ],
      ["Profil LinkedIn (s'ouvre dans un nouvel onglet)", cvFr.socialLinks[0]!.url],
    ]);
    expect(cvFr.socialLinks[0]!.slug).toBe('linkedin');
    expect(wrapper.text()).not.toContain('contact@example.org');
  });

  it('ouvre LinkedIn dans un nouvel onglet, sans référent, avec le style du bouton secondaire', async () => {
    const wrapper = await mount('/travaux');

    const linkedin = wrapper.findAll('main a')[1]!;
    expect(linkedin.attributes('target')).toBe('_blank');
    expect(linkedin.attributes('rel')).toBe('noopener noreferrer');
    expect(linkedin.classes()).toEqual(
      expect.arrayContaining(['base-button--outline', 'base-button--md']),
    );
    expect(linkedin.get('.visually-hidden').text()).toBe("(s'ouvre dans un nouvel onglet)");
    expect(linkedin.get('.base-button__icon').attributes('aria-hidden')).toBe('true');
  });

  it('en anglais : textes traduits, sujet anglais, profil LinkedIn du CV anglais', async () => {
    const wrapper = await mount('/en/work-in-progress');

    expect(wrapper.get('h1').text()).toBe('Site under construction');
    expect(wrapper.text()).toContain('In the meantime, you can email me or find me on LinkedIn.');
    const [contact, linkedin] = wrapper.findAll('main a');
    expect(contact!.text()).toBe('Start the interview');
    expect(contact!.attributes('href')).toBe(
      `mailto:contact@example.org?subject=${encodeURIComponent('Getting in touch from your website')}`,
    );
    expect(linkedin!.text()).toBe('LinkedIn profile (opens in a new tab)');
    expect(linkedin!.attributes('href')).toBe(
      cvEn.socialLinks.find((link) => link.slug === 'linkedin')!.url,
    );
  });

  it('pose son titre, sa description et noindex, dans la langue de la page', async () => {
    await mount('/travaux');
    expect(document.title).toBe('Site en cours de construction');
    expect(meta('name="description"')).toBe(
      'Le site de Julien Lachaux est en cours de construction. En attendant, vous pouvez lui écrire ou le retrouver sur LinkedIn.',
    );
    expect(meta('name="robots"')).toBe('noindex');
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());

    await mount('/en/work-in-progress');
    expect(document.title).toBe('Site under construction');
    expect(meta('name="description"')).toBe(
      'Julien Lachaux’s website is under construction. In the meantime, you can email him or find him on LinkedIn.',
    );
    expect(meta('property="og:description"')).toBe(meta('name="description"'));
  });

  for (const email of ['', 'pas-une-adresse']) {
    it(`lève une erreur explicite sans adresse valide (« ${email} ») : la génération échoue`, async () => {
      useRuntimeConfig().public.contactEmail = email;

      await expect(mountSuspended(WorkInProgressPage, { route: '/travaux' })).rejects.toThrow(
        'Adresse de contact absente ou invalide : NUXT_PUBLIC_CONTACT_EMAIL',
      );
    });
  }
});
