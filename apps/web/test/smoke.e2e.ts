import { expect, test } from '@playwright/test';

import { analyzeWcag22AA, expectShellMounted } from './support/e2e.js';

// Fumée (lot F0, page réelle depuis F3a) : la page d'accueil générée s'affiche dans les deux langues et les deux schémas
// de couleur système, avec `lang`, hreflang et un seul h1, sans violation axe WCAG 2.2 AA (D4).

const pages = [
  {
    locale: 'fr',
    path: '/',
    heading: 'Développeur full-stack',
    other: { locale: 'en', path: '/en' },
  },
  {
    locale: 'en',
    path: '/en',
    heading: 'Full-stack developer',
    other: { locale: 'fr', path: '/' },
  },
] as const;

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`schéma ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const { locale, path, heading, other } of pages) {
      test(`${path} (${locale}) : lang, hreflang, h1 unique, aucune violation axe`, async ({
        page,
      }) => {
        const response = await page.goto(path);

        expect(response?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveCount(1);
        await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
        expect(await page.evaluate(() => matchMedia(`(prefers-color-scheme: dark)`).matches)).toBe(
          colorScheme === 'dark',
        );

        // Page hydratée : un seul jeu d'en-têtes, donc un seul sélecteur de langue.
        await expectShellMounted(page);
        const results = await analyzeWcag22AA(page);
        expect(results.violations).toEqual([]);
        expect(results.passes.length).toBeGreaterThan(0);

        // Le sélecteur de langue seul : en anglais, le lien du CV porte aussi hreflang="fr" (D22).
        const switcher = page.locator('.language-switch');
        await expect(switcher.locator('a[hreflang]')).toHaveCount(1);
        await switcher.locator(`a[hreflang="${other.locale}"]`).click();
        await expect(page).toHaveURL(other.path);
        await expect(page.locator('html')).toHaveAttribute('lang', other.locale);
      });
    }
  });
}

// Témoin de l'oracle : la même analyse axe signale bien une page non conforme (sans `lang`, image
// sans alternative, contraste insuffisant), sinon une liste vide ci-dessus ne prouverait rien.
test('axe signale les violations WCAG 2.2 AA d’une page non conforme', async ({ page }) => {
  await page.setContent(
    '<html><head><title>t</title></head><body><main><h1>Titre</h1>' +
      '<p style="color:#aaa;background:#fff">Texte peu lisible</p>' +
      '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main></body></html>',
  );

  const results = await analyzeWcag22AA(page);

  expect(results.violations.map((v) => v.id).sort()).toEqual([
    'color-contrast',
    'html-has-lang',
    'image-alt',
  ]);
});
