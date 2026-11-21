import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

// Bouton « CV PDF » (D22) : dans chaque langue et à chaque taille d'écran, le lien visible mène à un
// vrai PDF (200, `application/pdf`, signature `%PDF-`), jamais à un 404. Le lien est suivi par le
// navigateur lui-même (`fetch` de son adresse dans la page), comme un clic sans téléchargement.
// Attendu selon public/cv/ : le CV de la langue s'il y est, sinon le CV français, signalé dans le nom
// du lien ; déposer `cv-<langue>.pdf` change l'attendu sans changer le test.

const cvDirectory = join(import.meta.dirname, '../public/cv');

const LOCALES = [
  { code: 'fr', path: '/', fallbackName: 'CV PDF (en français)' },
  { code: 'en', path: '/en', fallbackName: 'CV PDF (in French)' },
] as const;

for (const { code, path, fallbackName } of LOCALES) {
  test(`${code} (${path}) : le lien « CV PDF » mène à un PDF servi`, async ({ page }) => {
    const own = `cv-${code}.pdf`;
    const expected = existsSync(join(cvDirectory, own))
      ? { href: `/cv/${own}`, name: 'CV PDF' }
      : { href: '/cv/cv-fr.pdf', name: fallbackName };
    await page.goto(path);
    await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);

    const link = page.locator('a[download]:visible');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('type', 'application/pdf');
    await expect(link).toHaveAttribute('href', expected.href);
    await expect(link).toHaveAccessibleName(expected.name);
    // Repli : le CV français est signalé aussi par la langue du lien (hreflang), pas seulement par le nom.
    if (expected.href === '/cv/cv-fr.pdf' && code !== 'fr') {
      await expect(link).toHaveAttribute('hreflang', 'fr');
    } else {
      await expect(link).not.toHaveAttribute('hreflang');
    }
    const href = await link.getAttribute('href');

    const response = await page.evaluate(async (url) => {
      const result = await fetch(url);
      const bytes = new Uint8Array(await result.arrayBuffer());
      return {
        status: result.status,
        type: result.headers.get('content-type'),
        signature: String.fromCharCode(...bytes.subarray(0, 5)),
      };
    }, href ?? '');

    expect(response).toEqual({ status: 200, type: 'application/pdf', signature: '%PDF-' });
  });
}
