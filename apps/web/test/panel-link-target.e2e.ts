import { expect, test } from '@playwright/test';

// Cible du lien « Déclaration d'accessibilité » du panneau (constat RA-9) : sous 1024 px, les cibles
// tactiles font 44 px au moins (exigence du projet, `--touch-target`). Le lien du pied du panneau n'avait
// que la hauteur de sa ligne de texte. La taille de fenêtre est posée par chaque groupe.

const LOCALES = {
  fr: { path: '/', trigger: 'Options d’accessibilité', link: 'Déclaration d’accessibilité' },
  en: { path: '/en', trigger: 'Accessibility options', link: 'Accessibility statement' },
} as const;

const SIZES = [
  { width: 390, height: 844 },
  { width: 834, height: 1112 },
] as const;

for (const size of SIZES) {
  test.describe(`${size.width} px`, () => {
    test.use({ viewport: size });

    for (const code of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
      test(`${code} : le lien de la déclaration a une cible de 44 px au moins`, async ({
        page,
      }) => {
        const locale = LOCALES[code];
        await page.goto(locale.path);
        await expect(page.locator('.app-shell[data-mode="tabs"]')).toHaveCount(1);
        await page.getByRole('button', { name: locale.trigger, exact: true }).click();
        const link = page.getByRole('dialog').getByRole('link', { name: locale.link });
        await expect(link).toBeVisible();

        const box = (await link.boundingBox())!;
        expect(box.height, 'hauteur de la cible').toBeGreaterThanOrEqual(44);
      });
    }
  });
}
