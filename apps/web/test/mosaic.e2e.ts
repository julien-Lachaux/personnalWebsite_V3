import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { computeLayout, EXPANDED_MAX_WIDTH, GAP } from '../app/domain/layout.js';
import type { MosaicLayout, Rect, TileId } from '../app/domain/layout-types.js';

// Mosaïque du bureau (lot F6, SPEC § 3.3 à § 4.2), à chaque taille d'écran des maquettes, en français et
// en anglais, thèmes clair et sombre :
// - positions des tuiles conformes à `computeLayout` (zone = place sous la barre du haut, mesurée),
//   dont les cas des captures de référence recalculés à la main (1280 mosaïque, 1280 XP agrandie,
//   1024 XP agrandie) ;
// - agrandir puis réduire au clavier (bouton de la tuile, onglets de la barre du haut), focus ;
// - colonne latérale (≥ 1244 px) ou poussée hors zone (portable) ; Profil réduit sans défilement dans
//   la mosaïque, défilant en colonne latérale ; aucun recalcul après la fin de l'animation ;
// - axe WCAG 2.2 AA dans la mosaïque et en tuile agrandie ; mouvement réduit.
// Sous 1024 px, la vue par onglets est inchangée : chaque test le vérifie puis s'arrête.

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const STORAGE_KEY = 'siteperso:preferences';
const TILES: readonly TileId[] = ['profile', 'experience', 'recommendations', 'ai'];

const LOCALES = {
  fr: {
    path: '/',
    expandXp: 'Agrandir Expérience',
    collapseXp: 'Réduire Expérience',
    overview: 'Vue d’ensemble',
  },
  en: {
    path: '/en',
    expandXp: 'Expand Experience',
    collapseXp: 'Collapse Experience',
    overview: 'Overview',
  },
} as const;

type LocaleCode = keyof typeof LOCALES;

const THEMES = ['clair', 'sombre'] as const;

/** Sous 1024 px : onglets, pas de mosaïque. */
function tabsMode(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

async function storeTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: JSON.stringify({ version: 1, theme }),
  });
}

function grid(page: Page): Locator {
  return page.locator('.tile-grid');
}

function tile(page: Page, id: TileId): Locator {
  return page.locator(`[data-tile="${id}"]`);
}

/** Attend la fin de toutes les transitions des tuiles. */
async function settled(page: Page): Promise<void> {
  await grid(page).evaluate((element) =>
    Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
}

/**
 * Page chargée et hydratée. Sous 1024 px, vérifie que la vue par onglets est là sans mosaïque et rend
 * `false` ; sinon attend le premier placement des tuiles.
 */
async function open(page: Page, path: string): Promise<boolean> {
  await page.goto(path);
  await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
  if (tabsMode(page)) {
    await expect(page.locator('.app-shell')).toHaveAttribute('data-mode', 'tabs');
    await expect(grid(page)).toHaveCount(0);
    await expect(page.locator('.bottom-nav')).toBeVisible();
    return false;
  }
  await expect(page.locator('.app-shell')).toHaveAttribute('data-mode', 'mosaic');
  await expect(page.locator('.tile-grid:not(.tile-grid--instant)')).toHaveCount(1);
  await settled(page);
  return true;
}

/** Rectangles des tuiles dans le repère de la zone (la racine de la mosaïque). */
async function rects(page: Page): Promise<Record<TileId, Rect>> {
  return grid(page).evaluate((element) => {
    const origin = element.getBoundingClientRect();
    const entries = [...element.querySelectorAll<HTMLElement>('[data-tile]')].map((node) => {
      const box = node.getBoundingClientRect();
      return [
        node.dataset['tile'],
        { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height },
      ];
    });
    return Object.fromEntries(entries) as Record<TileId, Rect>;
  });
}

async function zone(page: Page): Promise<{ width: number; height: number }> {
  return grid(page).evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }));
}

/** Facteur S appliqué au contenu du Profil (1 sans transformation). */
async function profileScale(page: Page): Promise<number> {
  return tile(page, 'profile')
    .locator('.tile-grid__content--profile')
    .evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      return transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a;
    });
}

/**
 * Mise en page attendue : `computeLayout` avec la hauteur du Profil lue dans la page quand il n'est pas
 * réduit (S = 1 : sa hauteur de contenu est sa hauteur naturelle à sa largeur) ; réduit, il prend toute
 * la hauteur (contenu « non mesuré »).
 */
async function expectedLayout(page: Page, expanded: TileId | null): Promise<MosaicLayout> {
  const scale = await profileScale(page);
  const profileHeight = await tile(page, 'profile')
    .locator('.tile-grid__content--profile')
    .evaluate((element: HTMLElement) => element.offsetHeight);
  const layout = computeLayout({
    zone: await zone(page),
    expanded,
    textEnlarged: false,
    contentHeight: (id) =>
      id === 'profile' && scale === 1 ? Math.ceil(profileHeight + 0.5) : undefined,
  });
  if (layout.mode !== 'mosaic') throw new Error('mosaïque attendue');
  return layout;
}

function expectRect(actual: Rect, expected: Rect, label: string): void {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - expected[key]), `${label} : ${key}`).toBeLessThan(0.02);
  }
}

async function axe(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  expect(results.violations, label).toEqual([]);
  expect(
    results.passes.map((rule) => rule.id),
    label,
  ).toContain('color-contrast');
}

for (const code of Object.keys(LOCALES) as LocaleCode[]) {
  const locale = LOCALES[code];

  test.describe(`${code} (${locale.path})`, () => {
    test('zone : sous la barre du haut réelle, jusqu’au bas de la fenêtre, page sans défilement', async ({
      page,
    }) => {
      if (!(await open(page, locale.path))) return;

      const bar = await page.locator('.top-bar').boundingBox();
      const area = await grid(page).boundingBox();
      const viewport = page.viewportSize()!;
      expect(Math.abs((area?.y ?? 0) - ((bar?.y ?? 0) + (bar?.height ?? 0)))).toBeLessThan(0.5);
      expect(Math.abs((area?.y ?? 0) + (area?.height ?? 0) - viewport.height)).toBeLessThan(0.5);
      expect(area?.width).toBe(viewport.width);
      for (const rect of Object.values(await rects(page))) {
        expect(rect.y + rect.height).toBeLessThanOrEqual((area?.height ?? 0) - GAP + 0.02);
      }
      expect(
        await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight),
      ).toBe(true);
    });

    test('positions : mosaïque et XP agrandie conformes à computeLayout', async ({ page }) => {
      if (!(await open(page, locale.path))) return;

      const mosaic = await expectedLayout(page, null);
      const actual = await rects(page);
      for (const id of TILES) expectRect(actual[id], mosaic.tiles[id].rect, `mosaïque, ${id}`);

      await tile(page, 'experience').getByRole('button', { name: locale.expandXp }).click();
      await settled(page);
      const expanded = await expectedLayout(page, 'experience');
      const after = await rects(page);
      for (const id of TILES) {
        expect(await tile(page, id).isVisible(), `${id} visible`).toBe(expanded.tiles[id].visible);
        if (expanded.tiles[id].visible) {
          expectRect(after[id], expanded.tiles[id].rect, `XP agrandie, ${id}`);
        }
      }
    });

    test('cas des captures recalculés : 1280 × 844 et 1024 × 768', async ({ page }) => {
      if (!(await open(page, locale.path))) return;
      // Le cas se décide d'après la fenêtre et la langue, jamais d'après la mesure. La barre du haut fait
      // 56 px quand elle tient sur une ligne : zone de 788 px (1280, fr et en) ou 712 (1024, fr). À 1024
      // en anglais elle passe sur deux lignes (85 px, défaut connu F5c) : zone de 683 px, dont les
      // positions sont vérifiées par le test « positions conformes à computeLayout ». Les autres largeurs
      // n'ont pas de capture recalculée à la main.
      const width = page.viewportSize()!.width;
      const zones: Record<number, { width: number; height: number } | undefined> = {
        1280: { width: 1280, height: 788 },
        1024: code === 'fr' ? { width: 1024, height: 712 } : { width: 1024, height: 683 },
      };
      const expectedZone = zones[width];
      if (!expectedZone) return;
      expect(await zone(page), `zone à ${width} px (${code})`).toEqual(expectedZone);
      if (width === 1024 && code === 'en') return;

      if (width === 1280) {
        const mosaic = await rects(page);
        // SPEC § 3.4 : Profil 420, XP 100 % − 848, colonne de droite 380 (IA puis Recos, 376 px chacune).
        expectRect(mosaic.experience, { x: 444, y: 12, width: 432, height: 764 }, 'XP');
        expectRect(mosaic.ai, { x: 888, y: 12, width: 380, height: 376 }, 'IA');
        expectRect(mosaic.recommendations, { x: 888, y: 400, width: 380, height: 376 }, 'Recos');
        expect([mosaic.profile.x, mosaic.profile.y, mosaic.profile.width]).toEqual([12, 12, 420]);

        await tile(page, 'experience').getByRole('button', { name: locale.expandXp }).click();
        await settled(page);
        const expanded = await rects(page);
        // XP de 868 px à gauche ; colonne latérale de 376 px : Profil, Recos, IA (247, 246, 247).
        expectRect(expanded.experience, { x: 12, y: 12, width: 868, height: 764 }, 'XP');
        expectRect(expanded.profile, { x: 892, y: 12, width: 376, height: 247 }, 'Profil');
        expectRect(expanded.recommendations, { x: 892, y: 271, width: 376, height: 246 }, 'Recos');
        expectRect(expanded.ai, { x: 892, y: 529, width: 376, height: 247 }, 'IA');
        return;
      }

      const mosaic = await rects(page);
      // SPEC § 3.3 : Profil 360 px pleine hauteur, XP à 56 % (379 px), IA et Recos côte à côte dessous.
      expectRect(mosaic.profile, { x: 12, y: 12, width: 360, height: 688 }, 'Profil');
      expectRect(mosaic.experience, { x: 384, y: 12, width: 628, height: 379 }, 'XP');
      expectRect(mosaic.ai, { x: 384, y: 403, width: 308, height: 297 }, 'IA');
      expectRect(mosaic.recommendations, { x: 704, y: 403, width: 308, height: 297 }, 'Recos');

      await tile(page, 'experience').getByRole('button', { name: locale.expandXp }).click();
      await settled(page);
      const expanded = await rects(page);
      // Pas de place à côté : XP centrée (x = 78), les autres poussées hors de la zone : Profil à gauche,
      // Recos à droite, IA (même colonne que XP, en dessous) par le bas (D10).
      expectRect(expanded.experience, { x: 78, y: 12, width: 868, height: 688 }, 'XP');
      expect(expanded.profile.x + expanded.profile.width).toBeLessThanOrEqual(0);
      expect(expanded.ai.y).toBeGreaterThanOrEqual(712);
      expect(expanded.recommendations.x).toBeGreaterThanOrEqual(1024);
    });

    test('agrandir puis réduire au clavier : bouton de la tuile, focus gardé', async ({ page }) => {
      if (!(await open(page, locale.path))) return;
      const nav = page.locator('.top-bar__nav');
      const toggle = tile(page, 'experience').locator('.tile__toggle');

      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAccessibleName(locale.collapseXp);
      await expect(toggle).toBeFocused();
      await expect(nav.getByRole('button').nth(2)).toHaveAttribute('aria-current', 'true');
      await expect(tile(page, 'experience')).toHaveClass(/tile-grid__tile--expanded/);
      await settled(page);
      const zoneWidth = (await zone(page)).width;
      const expandedWidth = Math.min(Math.min(zoneWidth, 1440) - 2 * GAP, EXPANDED_MAX_WIDTH);
      expect((await rects(page)).experience.width).toBeCloseTo(expandedWidth, 1);

      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAccessibleName(locale.expandXp);
      await expect(toggle).toBeFocused();
      await expect(nav.getByRole('button', { name: locale.overview })).toHaveAttribute(
        'aria-current',
        'true',
      );
      await settled(page);
      const mosaic = await expectedLayout(page, null);
      expectRect((await rects(page)).experience, mosaic.tiles.experience.rect, 'XP réduite');
    });

    test('onglets de la barre du haut au clavier : focus dans la tuile agrandie, vue d’ensemble', async ({
      page,
    }) => {
      if (!(await open(page, locale.path))) return;
      const tabs = page.locator('.top-bar__nav').getByRole('button');

      await tabs.nth(3).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#section-recommendations')).toBeFocused();
      await expect(tile(page, 'recommendations')).toHaveClass(/tile-grid__tile--expanded/);
      await expect(tile(page, 'recommendations')).not.toHaveAttribute('inert');

      // Tab depuis le contenu : le prochain arrêt (lien source LinkedIn) est dans la tuile agrandie.
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(
          () => document.activeElement?.closest('[data-tile]')?.getAttribute('data-tile') ?? null,
        ),
      ).toBe('recommendations');

      await tabs.nth(0).focus();
      await page.keyboard.press('Enter');
      await expect(tabs.nth(0)).toHaveAttribute('aria-current', 'true');
      await expect(page.locator('.tile-grid__tile--expanded')).toHaveCount(0);
      await settled(page);
      for (const id of TILES) await expect(tile(page, id)).toBeVisible();
    });

    test('colonne latérale ou poussée hors zone, tuiles sorties inertes', async ({ page }) => {
      if (!(await open(page, locale.path))) return;
      const { width } = await zone(page);
      const innerWidth = Math.min(width, 1440) - 2 * GAP;
      const side = innerWidth - EXPANDED_MAX_WIDTH - GAP >= 340;

      await tile(page, 'experience').locator('.tile__toggle').click();
      await settled(page);

      for (const id of ['profile', 'recommendations', 'ai'] as const) {
        const other = tile(page, id);
        if (side) {
          await expect(other).toBeVisible();
          await expect(other).not.toHaveAttribute('inert');
          await expect(other).not.toHaveAttribute('aria-hidden');
        } else {
          await expect(other).toBeHidden();
          await expect(other).toHaveAttribute('inert', '');
          await expect(other).toHaveAttribute('aria-hidden', 'true');
          await expect(other).toHaveCSS('visibility', 'hidden');
        }
      }
      if (!side) {
        // Rien d'une tuile sortie n'est atteignable au clavier.
        const reachable = await page.evaluate(() =>
          [...document.querySelectorAll('[data-tile][inert] a, [data-tile][inert] button')].some(
            (element) => {
              (element as HTMLElement).focus();
              return document.activeElement === element;
            },
          ),
        );
        expect(reachable).toBe(false);
      }
    });

    test('Profil : réduit sans barre de défilement dans la mosaïque, défilant en colonne latérale', async ({
      page,
    }) => {
      if (!(await open(page, locale.path))) return;
      const body = tile(page, 'profile').locator('.tile__body');
      const content = tile(page, 'profile').locator('.tile-grid__content--profile');

      await expect(body).not.toHaveAttribute('tabindex');
      await expect(body).toHaveCSS('overflow-y', 'hidden');
      const fits = await body.evaluate((element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        const inner = element
          .querySelector('.tile-grid__content--profile')!
          .getBoundingClientRect();
        return {
          scrollbar: element.offsetWidth - element.clientWidth,
          bottom: inner.bottom - box.bottom,
          right: inner.right - box.right,
        };
      });
      expect(fits.scrollbar).toBe(0);
      expect(fits.bottom).toBeLessThanOrEqual(1);
      expect(fits.right).toBeLessThanOrEqual(1);
      const scale = await profileScale(page);
      expect(scale).toBeGreaterThanOrEqual(0.6);
      expect(scale).toBeLessThanOrEqual(1);
      await expect(page.locator('#section-profile .profile-title')).toBeVisible();

      const { width } = await zone(page);
      if (Math.min(width, 1440) - 2 * GAP - EXPANDED_MAX_WIDTH - GAP < 340) return;
      await tile(page, 'experience').locator('.tile__toggle').click();
      await settled(page);
      await expect(body).toHaveAttribute('tabindex', '0');
      await expect(content).toHaveCSS('transform', 'none');
      expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
        true,
      );
    });

    test('aucun recalcul après la fin de l’animation', async ({ page }) => {
      if (!(await open(page, locale.path))) return;

      for (const id of TILES) {
        await tile(page, id).locator('.tile__toggle').click();
        await settled(page);
        const end = await rects(page);
        const scale = await profileScale(page);
        await page.waitForTimeout(300);
        expect(await rects(page), `${id} agrandie`).toEqual(end);
        expect(await profileScale(page)).toBe(scale);
        expect(
          await grid(page).evaluate((element) => element.getAnimations({ subtree: true }).length),
        ).toBe(0);
        await tile(page, id).locator('.tile__toggle').click();
        await settled(page);
      }
    });

    test('animation : position, taille et S en 550 ms sur la courbe de la maquette, sortie différée', async ({
      page,
    }) => {
      if (!(await open(page, locale.path))) return;

      // Profil agrandi : sa place, sa taille et son facteur S changent ensemble.
      await tile(page, 'profile').locator('.tile__toggle').click();
      // Transitions des tuiles et du contenu du Profil (pas celles du bouton pressé).
      const transitions = await grid(page).evaluate((element) =>
        element
          .getAnimations({ subtree: true })
          .filter((animation) =>
            (animation.effect as KeyframeEffect).target!.matches(
              '[data-tile], .tile-grid__content--profile',
            ),
          )
          .map((animation) => {
            const timing = animation.effect!.getComputedTiming();
            return {
              property: (animation as CSSTransition).transitionProperty,
              out: (animation.effect as KeyframeEffect).target!.classList.contains(
                'tile-grid__tile--out',
              ),
              duration: timing.duration,
              delay: timing.delay,
              easing: timing.easing,
            };
          }),
      );
      const moving = transitions.filter(({ property }) => property !== 'visibility');
      // Seules bougent les propriétés qui changent (à 1024, le Profil garde son `top`), parmi la place,
      // la taille et S.
      const properties = moving.map(({ property }) => property);
      expect(properties).toEqual(expect.arrayContaining(['left', 'width']));
      for (const property of properties) {
        expect(['left', 'top', 'width', 'height', 'transform']).toContain(property);
      }
      for (const transition of moving) {
        expect(transition).toMatchObject({
          duration: 550,
          delay: 0,
          easing: 'cubic-bezier(0.4, 0, 0.15, 1)',
        });
      }
      // Les tuiles sorties restent visibles pendant le mouvement, puis `visibility: hidden`.
      for (const transition of transitions.filter(({ property }) => property === 'visibility')) {
        expect(transition).toMatchObject({ out: true, duration: 0, delay: 550 });
      }
      await settled(page);
    });

    test('mouvement réduit : aucune transition, géométrie finale tout de suite', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (!(await open(page, locale.path))) return;

      await tile(page, 'ai').locator('.tile__toggle').click();
      const durations = await grid(page).evaluate((element) =>
        element.getAnimations({ subtree: true }).map((animation) => {
          const timing = animation.effect!.getComputedTiming();
          return Number(timing.duration) + Number(timing.delay);
        }),
      );
      for (const duration of durations) expect(duration).toBeLessThan(1);
      await settled(page);
      // Place et largeur de la tuile agrandie (sa hauteur est celle de son contenu, non lue ici).
      const expected = (await expectedLayout(page, 'ai')).tiles.ai.rect;
      const actual = (await rects(page)).ai;
      expectRect(actual, { ...expected, height: actual.height }, 'IA agrandie');
    });

    for (const theme of THEMES) {
      test(`axe WCAG 2.2 AA, thème ${theme} : mosaïque, XP agrandie, Profil agrandi`, async ({
        page,
      }) => {
        await storeTheme(page, theme);
        if (!(await open(page, locale.path))) return;
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

        await axe(page, `${theme}, mosaïque`);
        for (const id of ['experience', 'profile'] as const) {
          await tile(page, id).locator('.tile__toggle').click();
          await settled(page);
          await axe(page, `${theme}, ${id} agrandie`);
          await tile(page, id).locator('.tile__toggle').click();
          await settled(page);
        }
      });
    }
  });
}
