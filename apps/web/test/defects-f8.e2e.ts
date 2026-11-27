import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  gotoMounted,
  storePreferences,
  tabsMode,
  waitForSettledAnimations,
} from './support/e2e.js';

// Défauts du lot F8 trouvés au texte agrandi à 130 % (WCAG 1.4.4 Redimensionnement du texte et 1.4.10
// Redistribution), chacun par une assertion ciblée sur l'élément fautif. Mesure : `scrollWidth` d'un
// conteneur qui rogne (`overflow-x` autre que `visible`) comparé à sa largeur visible, ou bord d'un
// contrôle comparé à la fenêtre. Ces tests échouent tant que le défaut existe.

const LOCALES = {
  fr: { path: '/', nav: 'Sections', recos: 'Recos', tabs: ['Profil', 'XP', 'Recos', 'IA'] },
  en: { path: '/en', nav: 'Sections', recos: 'Recs', tabs: ['Profile', 'XP', 'Recs', 'AI'] },
} as const;

type LocaleCode = keyof typeof LOCALES;

/** Page à 130 % : hydratée, animations finies. */
async function open130(page: Page, path: string): Promise<void> {
  await storePreferences(page, { theme: 'clair', textSize: 130 });
  await gotoMounted(page, path);
  await expect(page.locator('html')).toHaveAttribute('data-text-size', '130');
}

/** Contenu hors du conteneur qui rogne un élément : px de large en trop, 0 si tout est visible. */
async function clippedWidth(element: Locator): Promise<number> {
  return element.evaluate((node) => {
    let parent = node.parentElement;
    while (parent !== null && getComputedStyle(parent).overflowX === 'visible') {
      parent = parent.parentElement;
    }
    if (parent === null) return 0;
    const right = Math.max(
      ...[node, ...node.querySelectorAll('*')].map((child) => child.getBoundingClientRect().right),
    );
    return Math.max(0, Math.ceil(right - parent.getBoundingClientRect().right));
  });
}

for (const code of Object.keys(LOCALES) as LocaleCode[]) {
  const locale = LOCALES[code];

  test.describe(`${code} à 130 %`, () => {
    test('BUG-F1 : le lien « publiées sur LinkedIn » des recommandations n’est pas rogné', async ({
      page,
    }) => {
      await open130(page, locale.path);
      if (tabsMode(page)) {
        await page
          .getByRole('navigation', { name: locale.nav })
          .getByRole('button', { name: locale.recos, exact: true })
          .click();
      }
      const link = page
        .locator('#section-recommendations')
        .getByRole('link', { name: /LinkedIn/ })
        .first();
      await expect(link).toBeVisible();
      await waitForSettledAnimations(page);
      expect(await clippedWidth(link)).toBe(0);
    });

    test('BUG-F3 : les boutons de la barre d’actions tiennent dans la fenêtre', async ({
      page,
    }) => {
      await open130(page, locale.path);
      if (!tabsMode(page)) {
        await expect(page.locator('.action-bar')).toHaveCount(0);
        return;
      }
      await waitForSettledAnimations(page);
      const width = page.viewportSize()?.width ?? 0;
      for (const button of await page.locator('.action-bar').getByRole('link').all()) {
        const box = await button.boundingBox();
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      }
    });
  });
}
