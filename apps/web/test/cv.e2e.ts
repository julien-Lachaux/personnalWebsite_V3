import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { analyzeWcag22AA, gotoMounted } from './support/e2e.js';

// Menu « CV PDF » (D44, qui remplace le bouton et son repli de D22) : dans chaque langue et à chaque
// taille d'écran, le bouton ouvre la liste des deux versions. Une version dont le fichier est dans
// public/cv/ est un lien vers un vrai PDF (200, `application/pdf`, signature `%PDF-`), suivi par le
// navigateur lui-même (`fetch` dans la page), jamais un 404 ; sinon l'entrée reste affichée, inactive
// (`aria-disabled`, sans adresse), avec la mention « (bientôt) ». Déposer `cv-<langue>.pdf` change
// l'attendu sans changer le test. La liste ouverte reste dans l'écran (barre du haut ou barre d'actions).

const cvDirectory = join(import.meta.dirname, '../public/cv');

const LOCALES = [
  {
    code: 'fr',
    path: '/',
    labels: { fr: 'Version française', en: 'Version anglaise' },
    soon: '(bientôt)',
  },
  {
    code: 'en',
    path: '/en',
    labels: { fr: 'French version', en: 'English version' },
    soon: '(coming soon)',
  },
] as const;

for (const { code, path, labels, soon } of LOCALES) {
  test(`${code} (${path}) : le menu « CV PDF » propose les deux versions`, async ({ page }) => {
    await gotoMounted(page, path);

    const trigger = page.getByRole('button', { name: 'CV PDF', exact: true });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    for (const language of ['fr', 'en'] as const) {
      const present = existsSync(join(cvDirectory, `cv-${language}.pdf`));
      const name = present ? labels[language] : `${labels[language]} ${soon}`;
      const item = page.getByRole('link', { name, exact: true });
      await expect(item).toBeInViewport();

      if (!present) {
        await expect(item).toHaveAttribute('aria-disabled', 'true');
        await expect(item).not.toHaveAttribute('href');
        continue;
      }
      await expect(item).toHaveAttribute('href', `/cv/cv-${language}.pdf`);
      await expect(item).toHaveAttribute('hreflang', language);
      await expect(item).toHaveAttribute('type', 'application/pdf');
      const response = await page.evaluate(async (url) => {
        const result = await fetch(url);
        const bytes = new Uint8Array(await result.arrayBuffer());
        return {
          status: result.status,
          type: result.headers.get('content-type'),
          signature: String.fromCharCode(...bytes.subarray(0, 5)),
        };
      }, `/cv/cv-${language}.pdf`);
      expect(response).toEqual({ status: 200, type: 'application/pdf', signature: '%PDF-' });
    }
  });

  test(`${code} (${path}) : axe WCAG 2.2 AA, menu ouvert`, async ({ page }) => {
    await gotoMounted(page, path);
    await page.getByRole('button', { name: 'CV PDF', exact: true }).click();
    await expect(page.locator('.cv-menu__list:visible')).toHaveCount(1);
    await page.waitForTimeout(400);

    const results = await analyzeWcag22AA(page);

    expect(results.violations).toEqual([]);
  });

  test(`${code} (${path}) : un clic sur une zone neutre de la page referme le menu`, async ({
    page,
  }) => {
    await gotoMounted(page, path);

    const trigger = page.getByRole('button', { name: 'CV PDF', exact: true });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Marge gauche de la fenêtre, à mi-hauteur, loin du menu et hors des barres : aucune cible focalisable.
    const viewport = page.viewportSize()!;
    await page.mouse.click(2, viewport.height / 2);

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test(`${code} (${path}) : Échap referme le menu et rend le focus au bouton`, async ({ page }) => {
    await gotoMounted(page, path);

    const trigger = page.getByRole('button', { name: 'CV PDF', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });
}
