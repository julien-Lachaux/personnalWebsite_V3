import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtState, useRuntimeConfig } from '#imports';

import { UNINDEXED_PATH_STATE_KEY } from '../composables/seo/useSeo.js';
import WorkInProgressPage from './travaux.vue';

// Page « travaux en cours » (lot 31) : message, contact par le mailto de la configuration, CV PDF de la
// langue (repli sur le CV français), hors index, dans les deux langues.

async function flushHead(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function meta(selector: string): string | null {
  return document.head.querySelector(`meta[${selector}]`)?.getAttribute('content') ?? null;
}

const mounted: VueWrapper[] = [];
let saved: { contactEmail: string; cvFiles: string[] };

beforeEach(() => {
  const { public: config } = useRuntimeConfig();
  saved = { contactEmail: config.contactEmail, cvFiles: [...config.cvFiles] };
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  const { public: config } = useRuntimeConfig();
  config.contactEmail = saved.contactEmail;
  config.cvFiles = saved.cvFiles;
  clearNuxtState(UNINDEXED_PATH_STATE_KEY);
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
      'En attendant, vous pouvez m’écrire ou télécharger mon CV.',
    ]);
    expect(wrapper.find('.annex-page__back').exists()).toBe(false);
  });

  it('en français : contact par mailto (adresse non affichée), puis le CV PDF français', async () => {
    const wrapper = await mount('/travaux');

    const links = wrapper.findAll('main a');
    expect(links.map((link) => [link.text(), link.attributes('href')])).toEqual([
      [
        'Lancer l’entretien',
        `mailto:contact@example.org?subject=${encodeURIComponent('Prise de contact depuis votre site')}`,
      ],
      ['CV PDF', '/cv/cv-fr.pdf'],
    ]);
    const cv = links[1]!;
    expect(cv.attributes('type')).toBe('application/pdf');
    expect(cv.attributes('download')).toBeDefined();
    expect(cv.attributes('hreflang')).toBeUndefined();
    expect(wrapper.text()).not.toContain('contact@example.org');
  });

  it('en anglais : textes traduits, sujet anglais, CV français signalé tant que le CV anglais manque', async () => {
    useRuntimeConfig().public.cvFiles = ['cv-fr.pdf'];
    const wrapper = await mount('/en/work-in-progress');

    expect(wrapper.get('h1').text()).toBe('Site under construction');
    expect(wrapper.text()).toContain('In the meantime, you can email me or download my CV.');
    const [contact, cv] = wrapper.findAll('main a');
    expect(contact!.text()).toBe('Start the interview');
    expect(contact!.attributes('href')).toBe(
      `mailto:contact@example.org?subject=${encodeURIComponent('Getting in touch from your website')}`,
    );
    expect(cv!.text()).toBe('CV PDF (in French)');
    expect(cv!.attributes('href')).toBe('/cv/cv-fr.pdf');
    expect(cv!.attributes('hreflang')).toBe('fr');
  });

  it('en anglais : le CV anglais, dès qu’il est présent dans public/cv/', async () => {
    useRuntimeConfig().public.cvFiles = ['cv-en.pdf', 'cv-fr.pdf'];
    const wrapper = await mount('/en/work-in-progress');

    const cv = wrapper.findAll('main a')[1]!;
    expect(cv.text()).toBe('CV PDF');
    expect(cv.attributes('href')).toBe('/cv/cv-en.pdf');
    expect(cv.attributes('hreflang')).toBeUndefined();
  });

  it('pose son titre, sa description et noindex, dans la langue de la page', async () => {
    await mount('/travaux');
    expect(document.title).toBe('Site en cours de construction');
    expect(meta('name="description"')).toBe(
      'Le site de Julien Lachaux est en cours de construction. En attendant, vous pouvez lui écrire ou télécharger son CV.',
    );
    expect(meta('name="robots"')).toBe('noindex');
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());

    await mount('/en/work-in-progress');
    expect(document.title).toBe('Site under construction');
    expect(meta('name="description"')).toBe(
      'Julien Lachaux’s website is under construction. In the meantime, you can email him or download his CV.',
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
