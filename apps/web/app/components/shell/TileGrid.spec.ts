import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';

import { computeLayout } from '../../domain/layout.js';
import type { TileId, Zone } from '../../domain/layout-types.js';
import TileGrid from './TileGrid.vue';

// Mosaïque (lot F6) : tuiles placées par computeLayout, mesures sur clone hors écran, Profil réduit par
// S, tuiles sorties inertes, nouvelles mesures (ResizeObserver, réglages de <html>, polices). Le DOM de
// test ne calcule aucune mise en page : tailles de la zone et des clones simulées.

const TILES = ['profile', 'experience', 'recommendations', 'ai'] as const;

/** Taille de la zone (racine de la mosaïque). */
let zone: Zone = { width: 1280, height: 788 };
/** Surface du texte du Profil (hauteur = surface / largeur) ; autres contenus de hauteur fixe. */
let profileArea = 200_000;
const OTHERS = 300;
/** Largeurs mesurées sur un clone, par tuile. */
let measured: string[] = [];
/** Clones mesurés : identifiants restants, parent, styles posés. */
let clones: { ids: number; parent: string; visibility: string; transform: string }[] = [];

function contentHeight(tile: TileId, width: number): number {
  return tile === 'profile' ? profileArea / width : OTHERS;
}

/** `ResizeObserver` de remplacement : éléments observés, déclenchement manuel. */
class FakeResizeObserver {
  static last: FakeResizeObserver | null = null;
  observed: Element[] = [];
  disconnected = false;
  readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.last = this;
  }
  observe(element: Element): void {
    this.observed.push(element);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  fire(entries: { target: Element; width: number; height: number }[]): void {
    this.callback(
      entries.map(
        ({ target, width, height }) =>
          ({ target, contentRect: { width, height } }) as unknown as ResizeObserverEntry,
      ),
      this as unknown as ResizeObserver,
    );
  }
}

/** `MutationObserver` de remplacement. */
class FakeMutationObserver {
  static last: FakeMutationObserver | null = null;
  target: Node | null = null;
  options: MutationObserverInit | null = null;
  disconnected = false;
  readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeMutationObserver.last = this;
  }
  observe(target: Node, options: MutationObserverInit): void {
    this.target = target;
    this.options = options;
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

let fontsLoaded: () => void = () => undefined;
const mounted: VueWrapper[] = [];

beforeEach(() => {
  zone = { width: 1280, height: 788 };
  profileArea = 200_000;
  measured = [];
  clones = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('MutationObserver', FakeMutationObserver);
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      ready: new Promise<void>((resolve) => {
        fontsLoaded = resolve;
      }),
    },
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('tile-grid') ? zone.width : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('tile-grid') ? zone.height : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const tile = TILES.find((id) => this.classList.contains(`tile-grid__content--${id}`));
    const width = Number.parseFloat(this.style.width);
    if (tile !== undefined && this.style.left === '-99999px') {
      measured.push(`${tile}@${width}`);
      clones.push({
        ids: this.querySelectorAll('[id]').length + (this.id === '' ? 0 : 1),
        parent: this.parentElement?.className ?? '',
        visibility: this.style.visibility,
        transform: this.style.transform,
      });
      return { height: contentHeight(tile, width) } as DOMRect;
    }
    return { height: 0 } as DOMRect;
  });
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mountGrid(expanded: TileId | null = null): Promise<VueWrapper> {
  const wrapper = await mountSuspended(TileGrid, {
    props: { expanded },
    attachTo: document.body,
    slots: Object.fromEntries(
      TILES.map((id) => [
        id,
        () => h('div', { id: `contenu-${id}` }, [h('a', { href: `#${id}` }, `contenu ${id}`)]),
      ]),
    ),
  });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
}

function tile(wrapper: VueWrapper, id: TileId) {
  return wrapper.get(`[data-tile="${id}"]`);
}

function expectedRect(id: TileId, expanded: TileId | null) {
  const layout = computeLayout({
    zone,
    expanded,
    contentHeight: (tileId, innerWidth) =>
      Math.ceil(contentHeight(tileId, Math.min(innerWidth, 820)) + 0.5),
  });
  if (layout.mode !== 'mosaic') throw new Error('mosaïque attendue');
  const { x, y, width, height } = layout.tiles[id].rect;
  return `left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px;`;
}

describe('TileGrid : tuiles', () => {
  it('rend les quatre sections dans des tuiles nommées, fichier en titre, contenu en slot', async () => {
    const wrapper = await mountGrid();

    expect(
      wrapper.findAll('section.tile').map((section) => section.attributes('aria-label')),
    ).toEqual(['Profil', 'Expérience', 'Recommandations', 'IA']);
    expect(wrapper.findAll('.tile__title').map((title) => title.text())).toEqual([
      'profil.cv',
      'experience.log',
      'recommandations.md',
      'ia.md',
    ]);
    expect(
      wrapper.findAll('.tile__toggle').map((button) => button.attributes('aria-label')),
    ).toEqual([
      'Agrandir Profil',
      'Agrandir Expérience',
      'Agrandir Recommandations',
      'Agrandir IA',
    ]);
    for (const id of TILES) expect(tile(wrapper, id).text()).toContain(`contenu ${id}`);
  });

  it('le bouton d’une tuile demande son agrandissement', async () => {
    const wrapper = await mountGrid();

    await tile(wrapper, 'recommendations').get('.tile__toggle').trigger('click');

    expect(wrapper.emitted('toggle')).toEqual([['recommendations']]);
  });

  it('place chaque tuile selon computeLayout (desktop 1280, mosaïque)', async () => {
    const wrapper = await mountGrid();

    for (const id of TILES) {
      expect(tile(wrapper, id).attributes('style')).toBe(expectedRect(id, null));
    }
  });

  it('agrandie : bouton « Réduire », classe de la tuile agrandie ; les autres en colonne latérale (repliées)', async () => {
    const wrapper = await mountGrid('experience');

    const experience = tile(wrapper, 'experience');
    expect(experience.classes()).toContain('tile-grid__tile--expanded');
    expect(experience.get('.tile__toggle').attributes('aria-label')).toBe('Réduire Expérience');
    for (const id of TILES) {
      expect(tile(wrapper, id).attributes('style')).toBe(expectedRect(id, 'experience'));
      expect(tile(wrapper, id).attributes('inert')).toBeUndefined();
    }
  });

  it('pas de place à côté (1024) : les autres tuiles sortent, inertes et masquées', async () => {
    zone = { width: 1024, height: 700 };
    const wrapper = await mountGrid('experience');

    expect(TILES.map((id) => tile(wrapper, id).classes().includes('tile-grid__tile--out'))).toEqual(
      [true, false, true, true],
    );
    for (const id of ['profile', 'recommendations', 'ai'] as const) {
      expect(tile(wrapper, id).attributes('inert')).toBeDefined();
      expect(tile(wrapper, id).attributes('aria-hidden')).toBe('true');
    }
  });

  it('XP ne défile pas (sa liste défile seule) ; IA et Recos défilent au clavier', async () => {
    const wrapper = await mountGrid();

    expect(tile(wrapper, 'experience').get('.tile__body').attributes('tabindex')).toBeUndefined();
    expect(tile(wrapper, 'ai').get('.tile__body').attributes('tabindex')).toBe('0');
    expect(tile(wrapper, 'recommendations').get('.tile__body').attributes('tabindex')).toBe('0');
    expect(tile(wrapper, 'ai').find('.tile-grid__fade').exists()).toBe(true);
    expect(tile(wrapper, 'experience').find('.tile-grid__fade').exists()).toBe(false);
  });
});

describe('TileGrid : Profil', () => {
  it('contenu qui tient : taille normale, ni largeur imposée ni mise à l’échelle (D41)', async () => {
    const wrapper = await mountGrid();

    const content = tile(wrapper, 'profile').get('.tile-grid__content--profile');
    expect(content.attributes('style')).toBeUndefined();
    expect(tile(wrapper, 'profile').get('.tile__body').attributes('tabindex')).toBe('0');
  });

  it('contenu trop haut : aucune réduction, le Profil défile comme les autres tuiles', async () => {
    profileArea = 2_000_000;
    const wrapper = await mountGrid();

    expect(
      tile(wrapper, 'profile').get('.tile-grid__content--profile').attributes('style'),
    ).toBeUndefined();
    expect(tile(wrapper, 'profile').get('.tile__body').attributes('tabindex')).toBe('0');
    expect(tile(wrapper, 'profile').find('.tile-grid__fade').exists()).toBe(true);
  });
});

describe('TileGrid : tuiles repliées (D42)', () => {
  it('XP agrandie : Profil ouvert et défilant en colonne latérale, Recos et IA repliées (corps inerte, non lu, hors tabulation)', async () => {
    const wrapper = await mountGrid('experience');

    const profile = tile(wrapper, 'profile').get('.tile__body');
    expect(profile.attributes('inert')).toBeUndefined();
    expect(profile.attributes('aria-hidden')).toBeUndefined();
    expect(profile.attributes('tabindex')).toBe('0');
    for (const id of ['recommendations', 'ai'] as const) {
      const body = tile(wrapper, id).get('.tile__body');
      expect(body.attributes('inert')).toBeDefined();
      expect(body.attributes('aria-hidden')).toBe('true');
      expect(body.attributes('tabindex')).toBeUndefined();
      expect(tile(wrapper, id).get('.tile__toggle').attributes('disabled')).toBeUndefined();
    }
    const body = tile(wrapper, 'experience').get('.tile__body');
    expect(body.attributes('inert')).toBeUndefined();
    expect(body.attributes('aria-hidden')).toBeUndefined();
  });

  it('Recos agrandie : XP reste ouverte dans la colonne latérale, Profil et IA se replient', async () => {
    const wrapper = await mountGrid('recommendations');

    expect(tile(wrapper, 'experience').get('.tile__body').attributes('inert')).toBeUndefined();
    expect(tile(wrapper, 'profile').get('.tile__body').attributes('inert')).toBeDefined();
    expect(tile(wrapper, 'ai').get('.tile__body').attributes('inert')).toBeDefined();
    expect(tile(wrapper, 'recommendations').get('.tile__body').attributes('inert')).toBeUndefined();
  });

  it('le bouton d’une tuile repliée demande son agrandissement', async () => {
    const wrapper = await mountGrid('experience');

    await tile(wrapper, 'recommendations').get('.tile__toggle').trigger('click');

    expect(wrapper.emitted('toggle')).toEqual([['recommendations']]);
  });

  it('mosaïque : aucune tuile repliée', async () => {
    const wrapper = await mountGrid();

    for (const id of TILES) {
      expect(tile(wrapper, id).get('.tile__body').attributes('inert')).toBeUndefined();
    }
  });
});

describe('TileGrid : mesures', () => {
  it('mesure sur un clone hors écran sans identifiant, retiré aussitôt', async () => {
    const wrapper = await mountGrid();

    expect(clones.length).toBeGreaterThan(0);
    for (const clone of clones) {
      expect(clone).toEqual({
        ids: 0,
        parent: expect.stringContaining('tile-grid') as string,
        visibility: 'hidden',
        transform: 'none',
      });
    }
    expect(wrapper.get('.tile-grid').element.children).toHaveLength(4);
    expect(wrapper.find('#contenu-profile').exists()).toBe(true);
  });

  it('observe la zone et les contenus mesurés, puis s’en détache au démontage', async () => {
    const wrapper = await mountGrid();
    const observer = FakeResizeObserver.last!;
    const attributes = FakeMutationObserver.last!;

    expect(observer.observed).toEqual([
      wrapper.get('.tile-grid').element,
      wrapper.get('.tile-grid__content--profile').element,
      wrapper.get('.tile-grid__content--recommendations').element,
      wrapper.get('.tile-grid__content--ai').element,
    ]);
    expect(attributes.target).toBe(document.documentElement);
    expect(attributes.options).toEqual({
      attributes: true,
      attributeFilter: ['data-text-size', 'data-font', 'data-spacing'],
    });

    wrapper.unmount();
    mounted.splice(0);
    expect(observer.disconnected).toBe(true);
    expect(attributes.disconnected).toBe(true);
  });

  it('zone redimensionnée : nouvelle mise en page', async () => {
    const wrapper = await mountGrid();

    zone = { width: 1920, height: 1000 };
    FakeResizeObserver.last!.fire([
      { target: wrapper.get('.tile-grid').element, width: 1920, height: 1000 },
    ]);
    await nextTick();

    expect(tile(wrapper, 'experience').attributes('style')).toBe(expectedRect('experience', null));
  });

  it('contenu qui change de hauteur à largeur égale : remesuré ; qui change de largeur : rien', async () => {
    const wrapper = await mountGrid();
    const target = wrapper.get('.tile-grid__content--ai').element;
    const observer = FakeResizeObserver.last!;
    observer.fire([{ target, width: 380, height: 300 }]);
    measured = [];

    observer.fire([{ target, width: 400, height: 320 }]);
    expect(measured).toEqual([]);

    observer.fire([{ target, width: 400, height: 340 }]);
    expect(measured.length).toBeGreaterThan(0);
  });

  it('réglage du texte changé sur <html> : remesuré', async () => {
    await mountGrid();
    measured = [];

    FakeMutationObserver.last!.callback();

    expect(measured.length).toBeGreaterThan(0);
  });

  it('polices chargées : remesuré, sauf après le démontage', async () => {
    const wrapper = await mountGrid();
    profileArea = 220_000;
    fontsLoaded();
    await nextTick();
    await nextTick();

    expect(tile(wrapper, 'profile').attributes('style')).toBe(expectedRect('profile', null));
    // 220000 / 417 = 527,6 → 529 (arrondi, + 0,5 px de décor) + 48 de barre et bordures.
    expect(tile(wrapper, 'profile').attributes('style')).toContain('height: 577px');
  });

  it('polices chargées après le démontage : rien n’est mesuré', async () => {
    const wrapper = await mountGrid();
    wrapper.unmount();
    mounted.splice(0);
    measured = [];

    fontsLoaded();
    await Promise.resolve();
    await Promise.resolve();

    expect(measured).toEqual([]);
  });

  it('premier placement sans animation (classe `--instant`)', async () => {
    const wrapper = await mountGrid();

    expect(wrapper.get('.tile-grid').classes()).toContain('tile-grid--instant');
  });
});
