import { expect, test } from '@playwright/test';

import { expectAxeClean, gotoMounted, storePreferences, tabsMode } from './support/e2e.js';

// Matrice du lot F8 : chaque taille d'écran (un projet Playwright par taille) x thème (clair, sombre) x
// langue (fr, en), avec et sans contraste renforcé, au texte agrandi à 130 % (plus un passage à 100 %
// sur le bureau, où les parcours existants ne regardent que deux tuiles agrandies et deux palettes) :
// - axe WCAG 2.2 AA sur chaque section (onglets sous 1024 px) ou sur la mosaïque et chaque tuile agrandie
//   (bureau), après la fin des animations.
// Les débordements à 130 % sont mesurés par overflow.e2e.ts.
// Les parcours de shell.e2e.ts et mosaic.e2e.ts couvrent déjà les onglets à 100 % dans les quatre palettes.

const LOCALES = {
  fr: {
    path: '/',
    nav: 'Sections',
    tabs: ['Profil', 'XP', 'Recos', 'IA'],
    expand: /^Agrandir /,
    collapse: /^Réduire /,
  },
  en: {
    path: '/en',
    nav: 'Sections',
    tabs: ['Profile', 'XP', 'Recs', 'AI'],
    expand: /^Expand /,
    collapse: /^Collapse /,
  },
} as const;

type LocaleCode = keyof typeof LOCALES;

const PALETTES = [
  { name: 'clair', theme: 'clair', highContrast: false },
  { name: 'sombre', theme: 'sombre', highContrast: false },
  { name: 'clair renforcé', theme: 'clair', highContrast: true },
  { name: 'sombre renforcé', theme: 'sombre', highContrast: true },
] as const;

const TILES = ['profile', 'experience', 'recommendations', 'ai'] as const;
const SECTIONS = ['profile', 'experience', 'recommendations', 'ai'] as const;

for (const code of Object.keys(LOCALES) as LocaleCode[]) {
  const locale = LOCALES[code];

  for (const palette of PALETTES) {
    for (const textSize of [100, 130] as const) {
      test(`matrice ${code}, ${palette.name}, texte ${textSize} % : axe de chaque section`, async ({
        page,
      }) => {
        // Sous 1024 px, shell.e2e.ts couvre déjà le texte à 100 % dans les quatre palettes.
        if (tabsMode(page) && textSize === 100) return;

        await page.emulateMedia({ colorScheme: palette.theme === 'sombre' ? 'dark' : 'light' });
        await storePreferences(page, {
          theme: palette.theme,
          highContrast: palette.highContrast,
          textSize,
        });
        await gotoMounted(page, locale.path);
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', palette.theme);
        await expect(html).toHaveAttribute('data-text-size', String(textSize));
        if (palette.highContrast) await expect(html).toHaveAttribute('data-contrast', 'renforce');

        if (tabsMode(page)) {
          const nav = page.getByRole('navigation', { name: locale.nav });
          for (const [index, name] of locale.tabs.entries()) {
            await nav.getByRole('button', { name, exact: true }).click();
            await expect(page.locator(`#section-${SECTIONS[index]}`)).toBeVisible();
            await expectAxeClean(page, `onglet ${name}`);
          }
          return;
        }

        await expect(page.locator('.tile-grid:not(.tile-grid--instant)')).toHaveCount(1);
        await expectAxeClean(page, 'mosaïque');
        for (const id of TILES) {
          const tile = page.locator(`[data-tile="${id}"]`);
          await tile.getByRole('button', { name: locale.expand }).click();
          await expect(tile).toHaveClass(/tile-grid__tile--expanded/);
          await expectAxeClean(page, `tuile ${id} agrandie`);
          await tile.getByRole('button', { name: locale.collapse }).click();
          await expect(page.locator('.tile-grid__tile--expanded')).toHaveCount(0);
        }
      });
    }
  }
}
