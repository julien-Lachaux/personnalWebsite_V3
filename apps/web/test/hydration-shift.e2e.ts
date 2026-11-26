import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { computeLayout } from '../app/domain/layout.js';
import type { Rect, TileId } from '../app/domain/layout-types.js';

// Saut à l'hydratation (D49, ticket F11-02) : la page générée dessine déjà la mosaïque de la vue
// d'ensemble, le montage ne fait que poser les positions calculées. À chaque taille d'écran des
// maquettes, en français et en anglais :
// - bureau (≥ 1024 px) : rectangles des tuiles et de leur contenu avant le montage (application
//   bloquée : seul le script de thème s'exécute) égaux à ceux d'après le montage, et à ceux de
//   `computeLayout` (la CSS et la mise en page restent d'accord) ; seul écart admis, le bas du Profil
//   en 3 colonnes (hauteur du contenu dans la CSS, arrondie au pixel supérieur par la mise en page :
//   moins de 3 px) ;
// - sans JavaScript (D49) : la page ne défile pas, chaque tuile défile seule, le bouton « agrandir »
//   reste sans effet ; barres de titre affichées ; axe WCAG 2.2 AA ;
// - mobile et tablette : le Profil avant le montage à la place exacte de l'onglet Profil monté, sans
//   décor de tuile ni autre section.

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const TILES: readonly TileId[] = ['profile', 'experience', 'recommendations', 'ai'];
const PATHS = ['/', '/en'] as const;
/** Écart admis (px) entre deux rectangles qui doivent être égaux (arrondis du moteur). */
const SAME = 0.02;
/** Écart admis (px) sur la hauteur du Profil en 3 colonnes (voir l'en-tête). */
const PROFILE_HEIGHT = 3;

function desktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

function threeColumns(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1200;
}

/**
 * Ouvre `path` avec le JavaScript de l'application bloqué (la page générée telle quelle) ; rend la
 * liste des scripts refusés, témoin que l'application n'a pas démarré.
 */
async function openStatic(page: Page, path: string): Promise<string[]> {
  const blocked: string[] = [];
  await page.route('**/_nuxt/**/*.js', (route) => {
    blocked.push(route.request().url());
    return route.abort();
  });
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.locator('.app-shell')).toHaveCount(1);
  await expect(page.locator('.app-shell[data-mode]')).toHaveCount(0);
  expect(blocked.length).toBeGreaterThan(0);
  return blocked;
}

/** Ouvre `path` avec l'application ; attend le montage, les polices, le placement et les animations. */
async function openMounted(page: Page, path: string): Promise<void> {
  await page.unrouteAll();
  await page.goto(path);
  await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  if (!desktop(page)) return;
  await expect(page.locator('.tile-grid.tile-grid--placed:not(.tile-grid--instant)')).toHaveCount(
    1,
  );
  await page
    .locator('.tile-grid')
    .evaluate((element) =>
      Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
}

interface Snapshot {
  zone: { width: number; height: number };
  tiles: Record<TileId, Rect>;
  /** Contenu de chaque tuile (`#section-<id>`) : coin haut gauche. */
  contents: Record<TileId, { x: number; y: number }>;
  /** Hauteur du contenu du Profil (sa hauteur naturelle à sa largeur). */
  profileContent: number;
}

/** Rectangles des tuiles et de leur contenu dans le repère de la zone (racine de la mosaïque). */
async function snapshot(page: Page): Promise<Snapshot> {
  return page.locator('.tile-grid').evaluate((grid: HTMLElement) => {
    const origin = grid.getBoundingClientRect();
    const tiles: Record<string, Rect> = {};
    const contents: Record<string, { x: number; y: number }> = {};
    for (const node of grid.querySelectorAll<HTMLElement>('[data-tile]')) {
      const id = node.dataset['tile']!;
      const box = node.getBoundingClientRect();
      tiles[id] = {
        x: box.x - origin.x,
        y: box.y - origin.y,
        width: box.width,
        height: box.height,
      };
      const content = node.querySelector(`#section-${id}`)!.getBoundingClientRect();
      contents[id] = { x: content.x - origin.x, y: content.y - origin.y };
    }
    const profile = grid.querySelector<HTMLElement>('.tile-grid__content--profile')!;
    return {
      zone: { width: grid.clientWidth, height: grid.clientHeight },
      tiles,
      contents,
      profileContent: profile.getBoundingClientRect().height,
    };
  });
}

function expectSameRect(page: Page, actual: Rect, expected: Rect, id: TileId, label: string): void {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const tolerance =
      id === 'profile' && key === 'height' && threeColumns(page) ? PROFILE_HEIGHT : SAME;
    expect(Math.abs(actual[key] - expected[key]), `${label}, ${id} : ${key}`).toBeLessThan(
      tolerance,
    );
  }
}

async function axe(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  expect(results.violations, label).toEqual([]);
}

for (const path of PATHS) {
  test.describe(`${path}`, () => {
    test('bureau : tuiles avant le montage à leur place montée, celle de computeLayout', async ({
      page,
    }) => {
      if (!desktop(page)) return;

      await openStatic(page, path);
      const before = await snapshot(page);
      const layout = computeLayout({
        zone: before.zone,
        expanded: null,
        contentHeight: (id) =>
          id === 'profile' ? Math.ceil(before.profileContent + 0.5) : undefined,
      });
      if (layout.mode !== 'mosaic') throw new Error('mosaïque attendue');
      for (const id of TILES) {
        expectSameRect(page, before.tiles[id], layout.tiles[id].rect, id, 'avant / computeLayout');
      }

      await openMounted(page, path);
      const after = await snapshot(page);
      expect(after.zone).toEqual(before.zone);
      for (const id of TILES) {
        expectSameRect(page, after.tiles[id], before.tiles[id], id, 'après / avant');
        for (const key of ['x', 'y'] as const) {
          expect(
            Math.abs(after.contents[id][key] - before.contents[id][key]),
            `contenu de ${id} : ${key}`,
          ).toBeLessThan(SAME);
        }
      }
    });

    test('bureau sans JavaScript : la page ne défile pas, chaque tuile défile seule, « agrandir » sans effet, axe', async ({
      page,
    }) => {
      if (!desktop(page)) return;

      await openStatic(page, path);
      await expect(page.locator('.top-bar')).toBeVisible();
      await expect(page.locator('.tile__bar:visible')).toHaveCount(TILES.length);
      expect(
        await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight),
      ).toBe(true);

      const before = await snapshot(page);
      for (const id of TILES) {
        if (id === 'experience') continue;
        const body = page.locator(`[data-tile="${id}"] .tile__body`);
        expect(await body.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
        const overflows = await body.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        );
        if (!overflows) continue;
        await body.hover();
        await page.mouse.wheel(0, 200);
        await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
      }

      await page.locator('[data-tile="profile"] .tile__toggle').click();
      const after = await snapshot(page);
      for (const id of TILES) expectSameRect(page, after.tiles[id], before.tiles[id], id, 'clic');
      await expect(page.locator('.tile-grid__tile--expanded')).toHaveCount(0);

      await axe(page, `${path} avant le montage`);
    });

    test('mobile et tablette : le Profil avant le montage à la place de l’onglet Profil monté', async ({
      page,
    }) => {
      if (desktop(page)) return;

      const profile = page.locator('#contenu .profile');
      await openStatic(page, path);
      await expect(profile).toHaveCount(1);
      await expect(profile).toBeVisible();
      await expect(page.locator('.tile__bar:visible')).toHaveCount(0);
      await expect(page.locator('[data-tile]:visible')).toHaveCount(1);
      await expect(page.locator('.top-bar')).toBeHidden();
      await expect(page.locator('.bottom-nav')).toBeVisible();
      const before = await profile.boundingBox();
      const text = await profile.innerText();
      await axe(page, `${path} avant le montage`);

      await openMounted(page, path);
      await expect(page.locator('.tile-grid')).toHaveCount(0);
      const after = await profile.boundingBox();
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs((after?.[key] ?? -1) - (before?.[key] ?? -2)), key).toBeLessThan(SAME);
      }
      expect(await profile.innerText()).toBe(text);
    });
  });
}
