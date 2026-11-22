import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { useRuntimeConfig } from '#imports';

import DeclarationPage from './accessibilite.vue';

// Déclaration d'accessibilité (F7-01) : rubriques du modèle du RGAA, état « non conforme » faute
// d'audit, contact par le mailto de la configuration, voies de recours, référencement de la page.

async function flushHead(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function meta(selector: string): string | null {
  return document.head.querySelector(`meta[${selector}]`)?.getAttribute('content') ?? null;
}

let original: string;

beforeEach(() => {
  original = useRuntimeConfig().public.contactEmail;
});

afterEach(() => {
  useRuntimeConfig().public.contactEmail = original;
});

async function mount(route: string): Promise<VueWrapper> {
  const wrapper = await mountSuspended(DeclarationPage, { route });
  await flushHead();
  return wrapper;
}

describe('déclaration d’accessibilité : rubriques', () => {
  it('en français : h1, mention provisoire, puis les rubriques du RGAA dans l’ordre', async () => {
    const wrapper = await mount('/accessibilite');

    expect(wrapper.findAll('h1').map((heading) => heading.text())).toEqual([
      'Déclaration d’accessibilité',
    ]);
    expect(wrapper.get('.declaration__notice').text()).toBe(
      'Version provisoire : la déclaration définitive sera publiée après l’audit du site.',
    );
    expect(wrapper.findAll('h2').map((heading) => heading.text())).toEqual([
      'État de conformité',
      'Référentiel visé',
      'Technologies utilisées',
      'Environnement de test',
      'Contenus non accessibles',
      'Retour d’information et contact',
      'Voies de recours',
    ]);
    expect(wrapper.get('.annex-page__bar').text()).toBe('>_ declaration-accessibilite.md');
    expect(wrapper.get('.declaration__date').text()).toBe(
      'Déclaration provisoire établie le 21 novembre 2026.',
    );
  });

  it('en anglais, sous /en/accessibility', async () => {
    const wrapper = await mount('/en/accessibility');

    expect(wrapper.get('h1').text()).toBe('Accessibility statement');
    expect(wrapper.findAll('h2').map((heading) => heading.text())).toEqual([
      'Compliance status',
      'Target standard',
      'Technologies used',
      'Test environment',
      'Inaccessible content',
      'Feedback and contact',
      'How to seek redress',
    ]);
    expect(wrapper.get('main a').attributes('href')).toBe('/en');
  });

  it('déclare le site non conforme, sans taux, et cite l’adresse du site', async () => {
    const wrapper = await mount('/accessibilite');

    const status = wrapper.findAll('h2')[0]!.element.nextElementSibling!;
    expect(status.querySelector('strong')?.textContent).toBe('non conforme');
    expect(status.textContent).toContain('n’a pas encore fait l’objet d’un audit');
    expect(wrapper.text()).not.toMatch(/\d+\s?%/);
    expect(wrapper.get('.declaration__site').text()).toBe('http://localhost:3001');
    expect(wrapper.text()).toContain('Cette déclaration s’applique au site http://localhost:3001.');
  });

  it('dit qu’aucun contenu non accessible n’est recensé tant que la liste est vide', async () => {
    const wrapper = await mount('/accessibilite');

    const heading = wrapper.findAll('h2')[4]!;
    expect(heading.text()).toBe('Contenus non accessibles');
    expect(heading.element.nextElementSibling?.tagName).toBe('P');
    expect(heading.element.nextElementSibling?.textContent).toBe(
      'Aucun défaut d’accessibilité n’est recensé à ce jour. Cette liste sera établie par l’audit.',
    );
  });
});

describe('déclaration d’accessibilité : contact et recours', () => {
  it('propose un mailto vers l’adresse de la configuration, sujet traduit, sans l’afficher', async () => {
    const fr = await mount('/accessibilite');
    const link = fr.findAll('a').find((anchor) => anchor.text() === 'M’écrire par e-mail');
    expect(link?.attributes('href')).toBe(
      `mailto:contact@example.org?subject=${encodeURIComponent('Accessibilité du site')}`,
    );
    expect(fr.text()).not.toContain('contact@example.org');

    const en = await mount('/en/accessibility');
    const linkEn = en.findAll('a').find((anchor) => anchor.text() === 'Email me');
    expect(linkEn?.attributes('href')).toBe(
      `mailto:contact@example.org?subject=${encodeURIComponent('Website accessibility')}`,
    );
  });

  for (const email of ['', 'pas-une-adresse', 'a@b.fr?cc=x@y.org']) {
    it(`lève une erreur explicite sans adresse valide (« ${email} ») : la génération échoue`, async () => {
      useRuntimeConfig().public.contactEmail = email;

      await expect(mountSuspended(DeclarationPage, { route: '/accessibilite' })).rejects.toThrow(
        'Adresse de contact absente ou invalide : NUXT_PUBLIC_CONTACT_EMAIL',
      );
    });
  }

  it('renvoie au Défenseur des droits : message, délégués (pages en français), courrier', async () => {
    const wrapper = await mount('/en/accessibility');

    const external = wrapper.findAll('a[href^="https://"]');
    expect(external.map((link) => [link.attributes('href'), link.text()])).toEqual([
      [
        'https://www.defenseurdesdroits.fr/nous-contacter-355',
        'Send a message to the Défenseur des droits (in French)',
      ],
      [
        'https://www.defenseurdesdroits.fr/carte-des-delegues',
        'Contact a local delegate of the Défenseur des droits (in French)',
      ],
    ]);
    for (const link of external) {
      expect(link.attributes('rel')).toBe('noopener noreferrer');
      expect(link.attributes('hreflang')).toBe('fr');
      expect(link.attributes('target')).toBeUndefined();
    }
    expect(wrapper.get('.declaration__address').text()).toBe(
      'Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07, France',
    );
  });
});

describe('déclaration d’accessibilité : référencement', () => {
  it('a son titre et sa description, repris par Open Graph, dans chaque langue', async () => {
    await mount('/accessibilite');
    expect(document.title).toBe('Déclaration d’accessibilité');
    expect(meta('name="description"')).toBe(
      'État de conformité du site aux règles d’accessibilité (WCAG 2.2 AA, RGAA), contenus non accessibles connus, contact et voies de recours.',
    );
    expect(meta('property="og:description"')).toBe(meta('name="description"'));

    await mount('/en/accessibility');
    expect(document.title).toBe('Accessibility statement');
    expect(meta('name="description"')).toBe(
      'How this website conforms to accessibility standards (WCAG 2.2 AA, RGAA), known inaccessible content, contact and how to seek redress.',
    );
    expect(meta('property="og:description"')).toBe(meta('name="description"'));
  });
});
