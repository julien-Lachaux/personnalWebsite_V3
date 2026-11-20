import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';
import { useRuntimeConfig } from '#imports';

import { MOSAIC_QUERY } from '../../composables/shell/useShellMode.js';
import AppShell from './AppShell.vue';

// Coquille (F3a) : jeu d'en-têtes selon le mode, titres, onglets du mobile et glissement, barre du haut
// du bureau, adresse de contact exigée. La largeur est simulée par `matchMedia` (requête de la mosaïque).

// Adresse de test : un placeholder, jamais une vraie adresse (SPEC § 11).
const PLACEHOLDER = 'contact@example.org';
const SECTIONS = ['profile', 'experience', 'recommendations', 'ai'] as const;

let original = '';
const mounted: VueWrapper[] = [];

/** Largeur simulée : `true` à partir de 1024 px (mosaïque). */
function width(mosaic: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === MOSAIC_QUERY ? mosaic : false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

async function mountShell(route = '/'): Promise<VueWrapper> {
  const wrapper = await mountSuspended(AppShell, {
    route,
    attachTo: document.body,
    props: {
      heading: 'Développeur full-stack',
      cvPath: '/cv/exemple.pdf',
      declarationUrl: '/a11y',
    },
    slots: Object.fromEntries(SECTIONS.map((id) => [id, () => h('p', `contenu ${id}`)])),
  });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
}

function section(wrapper: VueWrapper, id: string) {
  return wrapper.get(`#section-${id}`);
}

beforeEach(() => {
  original = useRuntimeConfig().public.contactEmail;
  useRuntimeConfig().public.contactEmail = PLACEHOLDER;
  // `document.fonts` (lu par la flèche « faire défiler ») n'existe pas dans le DOM de test.
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  useRuntimeConfig().public.contactEmail = original;
  vi.restoreAllMocks();
});

describe('AppShell : adresse de contact', () => {
  for (const email of ['', 'pas-une-adresse', 'a@b.fr?cc=x@y.org']) {
    it(`lève une erreur explicite sans adresse valide (« ${email} ») : la génération échoue`, async () => {
      width(false);
      useRuntimeConfig().public.contactEmail = email;

      await expect(mountShell()).rejects.toThrow(
        'Adresse de contact absente ou invalide : NUXT_PUBLIC_CONTACT_EMAIL',
      );
    });
  }
});

describe('AppShell : structure commune', () => {
  it('a un <main id="contenu">, un h1 et un h2 par section, nommant chaque section', async () => {
    width(false);
    const wrapper = await mountShell();

    expect(wrapper.findAll('main')).toHaveLength(1);
    expect(wrapper.get('main').attributes('id')).toBe('contenu');
    expect(wrapper.findAll('h1').map((heading) => heading.text())).toEqual([
      'Développeur full-stack',
    ]);
    expect(wrapper.findAll('main section h2').map((heading) => heading.text())).toEqual([
      'Profil',
      'Expérience',
      'Recommandations',
      'IA',
    ]);
    for (const id of SECTIONS) {
      const title = section(wrapper, id).attributes('aria-labelledby');
      expect(wrapper.get(`#${title}`).element.tagName).toBe('H2');
      expect(section(wrapper, id).text()).toContain(`contenu ${id}`);
    }
  });

  it('titre les sections en anglais sur /en', async () => {
    width(true);
    const wrapper = await mountShell('/en');

    expect(wrapper.findAll('main section h2').map((heading) => heading.text())).toEqual([
      'Profile',
      'Experience',
      'Recommendations',
      'AI',
    ]);
  });
});

describe('AppShell : mobile et tablette (onglets)', () => {
  it('rend l’en-tête mobile, la barre d’actions et la navigation du bas, sans barre du haut', async () => {
    width(false);
    const wrapper = await mountShell();

    expect(wrapper.find('.mobile-header').exists()).toBe(true);
    expect(wrapper.find('.top-bar').exists()).toBe(false);
    expect(wrapper.findAll('header')).toHaveLength(1);
    expect(wrapper.find('.action-bar').exists()).toBe(true);
    expect(wrapper.find('.bottom-nav').exists()).toBe(true);
    expect(wrapper.findAll('[aria-haspopup="dialog"]')).toHaveLength(1);
    expect(wrapper.get('.app-shell').attributes('data-mode')).toBe('tabs');
  });

  it('n’affiche que l’onglet Profil au départ ; <main> défile et se focalise au clavier', async () => {
    width(false);
    const wrapper = await mountShell();

    expect(SECTIONS.map((id) => section(wrapper, id).attributes('hidden'))).toEqual([
      undefined,
      '',
      '',
      '',
    ]);
    expect(wrapper.get('main').attributes('tabindex')).toBe('0');
    expect(wrapper.get('h1').classes()).not.toContain('app-shell__heading--other-tab');
    expect(wrapper.get('.mobile-header').text()).toContain('profil.cv');
    expect(section(wrapper, 'profile').classes()).toEqual([
      'app-shell__section',
      'app-shell__section--current',
    ]);
  });

  it('change d’onglet : section, en-tête, onglet courant, glissement par la droite, défilement en haut', async () => {
    width(false);
    const wrapper = await mountShell();
    const main = wrapper.get('main').element;
    main.scrollTop = 120;

    await wrapper.findAll('.bottom-nav button')[1]!.trigger('click');

    expect(section(wrapper, 'experience').attributes('hidden')).toBeUndefined();
    expect(section(wrapper, 'profile').attributes('hidden')).toBe('');
    expect(section(wrapper, 'experience').classes()).toContain('app-shell__section--from-right');
    expect(wrapper.get('.mobile-header').text()).toContain('experience.log');
    expect(wrapper.findAll('.bottom-nav button')[1]!.attributes('aria-current')).toBe('true');
    expect(wrapper.get('h1').classes()).toContain('app-shell__heading--other-tab');
    expect(main.scrollTop).toBe(0);
  });

  it('affiche la flèche « faire défiler » quand <main> cache du contenu, et descend au clic', async () => {
    width(false);
    const wrapper = await mountShell();
    const main = wrapper.get('main').element;
    Object.defineProperty(main, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(main, 'clientHeight', { configurable: true, value: 500 });
    const scrollBy = vi.fn();
    main.scrollBy = scrollBy;
    expect(wrapper.find('.scroll-hint').exists()).toBe(false);

    main.dispatchEvent(new Event('scroll'));
    await nextTick();
    await wrapper.get('.scroll-hint').trigger('click');

    expect(scrollBy).toHaveBeenCalledWith({ top: 400, behavior: 'smooth' });
  });

  it('glisse par la gauche vers un onglet précédent ; l’onglet courant ne relance rien', async () => {
    width(false);
    const wrapper = await mountShell();
    const tabs = wrapper.findAll('.bottom-nav button');

    await tabs[3]!.trigger('click');
    await tabs[2]!.trigger('click');
    expect(section(wrapper, 'recommendations').classes()).toContain(
      'app-shell__section--from-left',
    );
    expect(section(wrapper, 'ai').classes()).toEqual(['app-shell__section']);

    await tabs[2]!.trigger('click');
    expect(section(wrapper, 'recommendations').classes()).toContain(
      'app-shell__section--from-left',
    );
  });
});

describe('AppShell : bureau (mosaïque)', () => {
  it('rend la barre du haut seule, toutes les sections, <main> hors de la tabulation', async () => {
    width(true);
    const wrapper = await mountShell();

    expect(wrapper.find('.top-bar').exists()).toBe(true);
    expect(wrapper.find('.mobile-header').exists()).toBe(false);
    expect(wrapper.find('.action-bar').exists()).toBe(false);
    expect(wrapper.find('.bottom-nav').exists()).toBe(false);
    expect(wrapper.find('.scroll-hint').exists()).toBe(false);
    expect(wrapper.findAll('[aria-haspopup="dialog"]')).toHaveLength(1);
    expect(SECTIONS.map((id) => section(wrapper, id).attributes('hidden'))).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(wrapper.get('main').attributes('tabindex')).toBe('-1');
    expect(wrapper.get('.app-shell').attributes('data-mode')).toBe('mosaic');
  });

  it('la barre du haut met le focus sur la section choisie, puis revient à la vue d’ensemble', async () => {
    width(true);
    const wrapper = await mountShell();
    const tabs = wrapper.findAll('.top-bar__nav button');
    expect(tabs[0]!.attributes('aria-current')).toBe('true');

    await tabs[2]!.trigger('click');
    await nextTick();
    expect(document.activeElement).toBe(section(wrapper, 'experience').element);
    expect(tabs[2]!.attributes('aria-current')).toBe('true');
    expect(tabs[0]!.attributes('aria-current')).toBeUndefined();

    await tabs[0]!.trigger('click');
    expect(tabs[0]!.attributes('aria-current')).toBe('true');
    expect(tabs[2]!.attributes('aria-current')).toBeUndefined();
  });
});
