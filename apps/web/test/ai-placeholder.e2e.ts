import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Section IA vide (lot F8, D27 et D28) : le site généré SANS section IA (`aiOverview` nul), par la
// génération `pnpm run generate:without-ai` (`test/support/generate-without-ai.mjs`, une « API » locale qui sert les fixtures
// du dépôt sans leur section IA ; le site est rangé dans `node_modules/.cache/site-sans-ia/`). Ce
// parcours le sert lui-même, sur un port libre, à côté du site habituel.
// À chaque taille d'écran, en français et en anglais :
// - le placeholder « placeholder » remplit l'onglet IA (sous 1024 px) ou la tuile IA, réduite et agrandie ;
// - le décor (picto, curseur) est `aria-hidden`, le bloc n'a rien d'interactif ;
// - axe WCAG 2.2 AA, contraste compris, dans les quatre palettes ;
// - mouvement réduit (préférence système ou réglage) : le curseur reste affiché et fixe ;
// - captures (mobile 390 clair et sombre, tuile IA du 1280 sombre) dans `F8_CAPTURES_DIR`
//   (défaut `test-results/f8-captures/`).

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const STORAGE_KEY = 'siteperso:preferences';
const SITE_DIR = resolve(import.meta.dirname, '../node_modules/.cache/site-sans-ia');
const CAPTURES_DIR =
  process.env['F8_CAPTURES_DIR'] ?? resolve(import.meta.dirname, '../test-results/f8-captures');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/** Fichier statique d'une URL du site généré (`/` → index.html, `/en` → en/index.html). */
function resolveFile(urlPath: string): string | undefined {
  const clean = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  for (const candidate of [clean, `${clean}/index.html`, `${clean}.html`]) {
    const file = join(SITE_DIR, candidate);
    if (file.startsWith(SITE_DIR) && existsSync(file) && statSync(file).isFile()) return file;
  }
  return undefined;
}

/** Serveur statique du site sans IA, un par worker, sur un port libre de la boucle locale. */
let server: Server | undefined;
let siteWithoutAi = '';

test.beforeAll(async () => {
  if (!existsSync(join(SITE_DIR, 'index.html'))) {
    throw new Error(
      'Site sans IA absent : lancer `pnpm run generate:without-ai` (apps/web), déjà fait par `test:e2e`.',
    );
  }
  const created = createServer((request, response) => {
    const file = resolveFile(request.url ?? '/');
    if (file === undefined) {
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('introuvable');
      return;
    }
    response
      .writeHead(200, {
        'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      })
      .end(readFileSync(file));
  });
  await new Promise<void>((done) => created.listen(0, '127.0.0.1', done));
  const address = created.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  siteWithoutAi = `http://localhost:${port}`;
  server = created;
});

test.afterAll(async () => {
  const current = server;
  if (current !== undefined) await new Promise((done) => current.close(done));
});

const LOCALES = {
  fr: {
    path: '/',
    nav: 'Sections',
    aiTab: 'IA',
    expand: /^Agrandir /,
    collapse: /^Réduire /,
    options: 'Options d’accessibilité',
  },
  en: {
    path: '/en',
    nav: 'Sections',
    aiTab: 'AI',
    expand: /^Expand /,
    collapse: /^Collapse /,
    options: 'Accessibility options',
  },
} as const;

type LocaleCode = keyof typeof LOCALES;

const PALETTES = [
  { name: 'clair', theme: 'clair', highContrast: false },
  { name: 'sombre', theme: 'sombre', highContrast: false },
  { name: 'clair renforcé', theme: 'clair', highContrast: true },
  { name: 'sombre renforcé', theme: 'sombre', highContrast: true },
] as const;

function tabsMode(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

async function storePreferences(page: Page, preferences: Record<string, unknown>): Promise<void> {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: JSON.stringify({ version: 1, ...preferences }),
  });
}

async function waitForSettledAnimations(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getComputedTiming().endTime === Infinity,
      ),
  );
}

/** Ouvre le site sans IA et rend la section IA affichée (onglet IA, ou tuile IA de la mosaïque). */
async function openAi(page: Page, site: string, code: LocaleCode) {
  const locale = LOCALES[code];
  await page.goto(`${site}${locale.path}`);
  await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
  if (tabsMode(page)) {
    await page
      .getByRole('navigation', { name: locale.nav })
      .getByRole('button', { name: locale.aiTab, exact: true })
      .click();
  } else {
    await expect(page.locator('.tile-grid:not(.tile-grid--instant)')).toHaveCount(1);
  }
  const section = page.locator('#section-ai');
  await expect(section).toBeVisible();
  await waitForSettledAnimations(page);
  return section;
}

for (const code of Object.keys(LOCALES) as LocaleCode[]) {
  const locale = LOCALES[code];

  test.describe(`${code} (${locale.path}), site sans section IA`, () => {
    test('le placeholder remplit la section, sans contenu IA ni élément interactif', async ({
      page,
    }) => {
      const section = await openAi(page, siteWithoutAi, code);

      await expect(section.getByText('placeholder', { exact: true })).toBeVisible();
      await expect(section.locator('p, ul, li, h3, article')).toHaveCount(0);
      await expect(section.locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(
        0,
      );
      // Le « h2 » de la section reste celui de la coquille (libellé de la section : « IA », « AI ») ;
      // seul le texte du placeholder est identique dans les deux langues (D28).
      await expect(page.locator('#section-ai h2')).toHaveText(locale.aiTab);
    });

    test('le décor (picto et curseur) est aria-hidden, le texte reste lu', async ({ page }) => {
      const section = await openAi(page, siteWithoutAi, code);

      const hidden = section.locator('[aria-hidden="true"]');
      await expect(hidden).toHaveCount(2);
      await expect(section.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await expect(section.locator('span[aria-hidden="true"]')).toHaveText('');
      // Le texte « placeholder » n'est pas dans le décor : il est dans l'arbre d'accessibilité.
      await expect(section.getByText('placeholder', { exact: true })).not.toHaveAttribute(
        'aria-hidden',
        'true',
      );
      expect(
        await section
          .getByText('placeholder', { exact: true })
          .evaluate((node) => node.closest('[aria-hidden="true"]')),
      ).toBeNull();
    });

    test('tuile : le placeholder tient réduit puis agrandi (bureau), onglet IA (mobile)', async ({
      page,
    }) => {
      const section = await openAi(page, siteWithoutAi, code);
      if (tabsMode(page)) {
        await expect(page.locator('.tile-grid')).toHaveCount(0);
        return;
      }
      const tile = page.locator('[data-tile="ai"]');
      await expect(tile.getByText('placeholder', { exact: true })).toBeInViewport({ ratio: 1 });
      await tile.getByRole('button', { name: locale.expand }).click();
      await expect(tile).toHaveClass(/tile-grid__tile--expanded/);
      await waitForSettledAnimations(page);
      await expect(section.getByText('placeholder', { exact: true })).toBeInViewport({ ratio: 1 });
      await tile.getByRole('button', { name: locale.collapse }).click();
      await expect(page.locator('.tile-grid__tile--expanded')).toHaveCount(0);
    });

    for (const palette of PALETTES) {
      test(`axe WCAG 2.2 AA, palette ${palette.name} : contraste du placeholder`, async ({
        page,
      }, testInfo) => {
        await page.emulateMedia({ colorScheme: palette.theme === 'sombre' ? 'dark' : 'light' });
        await storePreferences(page, { theme: palette.theme, highContrast: palette.highContrast });
        await openAi(page, siteWithoutAi, code);
        await expect(page.locator('html')).toHaveAttribute('data-theme', palette.theme);

        const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
        expect(results.violations).toEqual([]);
        expect(results.passes.map((rule) => rule.id)).toContain('color-contrast');
        // Le contraste du placeholder est mesuré, pas « à vérifier » (fond translucide, image…).
        const unchecked = results.incomplete
          .filter((rule) => rule.id === 'color-contrast')
          .flatMap((rule) => rule.nodes.map((node) => node.target.join(' ')));
        expect(unchecked.filter((target) => target.includes('ai-placeholder'))).toEqual([]);
        // … et réussi : le texte « placeholder » figure dans les contrastes passés, à 4,5:1 au moins ;
        // le rapport mesuré est noté dans les annotations du rapport Playwright.
        const measured = results.passes
          .filter((rule) => rule.id === 'color-contrast')
          .flatMap((rule) => rule.nodes)
          .filter((node) => node.target.join(' ').includes('ai-placeholder'));
        expect(measured).not.toEqual([]);
        for (const node of measured) {
          const data = (node.any[0]?.data ?? {}) as {
            contrastRatio?: number;
            fgColor?: string;
            bgColor?: string;
          };
          expect(data.contrastRatio ?? 0).toBeGreaterThanOrEqual(4.5);
          testInfo.annotations.push({
            type: 'contraste du placeholder',
            description: `${node.target.join(' ')} : ${data.fgColor} sur ${data.bgColor} = ${data.contrastRatio}:1`,
          });
        }

        // Captures demandées par le lot : mobile 390 fr clair et sombre, tuile IA du 1280 sombre.
        if (code === 'fr' && !palette.highContrast) {
          const name = testInfo.project.name;
          if (name === 'mobile-390') {
            await page.screenshot({
              path: join(CAPTURES_DIR, `mobile-390-fr-${palette.name}.png`),
            });
          }
          if (name === 'desktop-1280' && palette.theme === 'sombre') {
            await page
              .locator('[data-tile="ai"]')
              .screenshot({ path: join(CAPTURES_DIR, 'tuile-ia-1280-fr-sombre.png') });
            await page.screenshot({ path: join(CAPTURES_DIR, 'mosaique-1280-fr-sombre.png') });
          }
        }
      });
    }

    test('mouvement réduit par le système : le curseur reste affiché, fixe', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const section = await openAi(page, siteWithoutAi, code);
      const cursor = section.locator('span[aria-hidden="true"]');

      await cursor.evaluate((node) =>
        Promise.all(node.getAnimations().map((animation) => animation.finished)),
      );
      const state = await cursor.evaluate((node) => {
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        return {
          iterations: style.animationIterationCount,
          opacity: style.opacity,
          running: node.getAnimations().filter((animation) => animation.playState === 'running')
            .length,
          visible: box.width > 0 && box.height > 0,
        };
      });
      expect(state).toEqual({ iterations: '1', opacity: '1', running: 0, visible: true });
    });

    test('réglage « réduire les animations » : même curseur fixe ; sinon il clignote', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const section = await openAi(page, siteWithoutAi, code);
      const cursor = section.locator('span[aria-hidden="true"]');
      expect(await cursor.evaluate((node) => getComputedStyle(node).animationIterationCount)).toBe(
        'infinite',
      );

      await page.getByRole('button', { name: locale.options, exact: true }).click();
      await page
        .getByRole('switch', {
          name: code === 'fr' ? 'Réduire les animations' : 'Reduce animations',
        })
        .click();
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduit');
      await cursor.evaluate((node) =>
        Promise.all(node.getAnimations().map((animation) => animation.finished)),
      );
      expect(await cursor.evaluate((node) => getComputedStyle(node).animationIterationCount)).toBe(
        '1',
      );
      expect(await cursor.evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
    });
  });
}
