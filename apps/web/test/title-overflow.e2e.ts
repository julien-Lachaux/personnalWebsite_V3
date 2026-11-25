import { expect, test, type Page } from '@playwright/test';

// Débordements de mots longs (constats RA-3 et RA-4, WCAG 1.4.4, 1.4.10, 1.4.12) :
// - le titre du Profil (« Développeur » en tête) ne sort pas de la fenêtre à 320 px, texte à 115 et 130 % ;
// - le bouton « CV PDF » (menu du CV, D44) de la barre d'actions n'est pas rogné à 390 px avec
//   l'espacement des textes et le texte à 130 %.
// La taille de fenêtre est posée par chaque groupe : le parcours ne dépend pas du projet Playwright.

const STORAGE_KEY = 'siteperso:preferences';

const LOCALES = {
  fr: { path: '/', nav: 'Sections' },
  en: { path: '/en', nav: 'Sections' },
} as const;

async function open(
  page: Page,
  path: string,
  preferences: { textSize: number; textSpacing?: boolean },
): Promise<void> {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: JSON.stringify({ version: 1, theme: 'clair', ...preferences }),
  });
  await page.goto(path);
  await expect(page.locator('.app-shell[data-mode="tabs"]')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute(
    'data-text-size',
    String(preferences.textSize),
  );
}

/** Plus grand dépassement (px) du texte de `selector` hors de son propre conteneur ou de la fenêtre. */
async function textOverflow(page: Page, selector: string): Promise<number> {
  return page.evaluate((target) => {
    const container = document.querySelector<HTMLElement>(target)!;
    const limit = Math.min(
      container.getBoundingClientRect().right,
      document.documentElement.clientWidth,
    );
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let worst = container.scrollWidth - container.clientWidth;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) worst = Math.max(worst, rect.right - limit);
    }
    return worst;
  }, selector);
}

test.describe('320 px, titre du Profil', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const code of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    for (const textSize of [100, 115, 130]) {
      test(`${code} : le titre reste dans la fenêtre, texte à ${textSize} %`, async ({ page }) => {
        await open(page, LOCALES[code].path, { textSize });

        expect(
          await textOverflow(page, '.profile-title'),
          'texte du titre en trop',
        ).toBeLessThanOrEqual(0);
        const page_ = await page.evaluate(() => {
          const root = document.documentElement;
          return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
        });
        expect(page_, 'largeur de page en trop').toBeLessThanOrEqual(0);
      });
    }

    test(`${code} : le titre reste dans la fenêtre avec l’espacement des textes à 130 %`, async ({
      page,
    }) => {
      await open(page, LOCALES[code].path, { textSize: 130, textSpacing: true });

      expect(
        await textOverflow(page, '.profile-title'),
        'texte du titre en trop',
      ).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('390 px, barre d’actions', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const code of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    test(`${code} : « CV PDF » n’est pas rogné avec l’espacement et le texte à 130 %`, async ({
      page,
    }) => {
      await open(page, LOCALES[code].path, { textSize: 130, textSpacing: true });

      expect(
        await textOverflow(page, '.action-bar__cv'),
        'texte du CV en trop',
      ).toBeLessThanOrEqual(0);
      expect(
        await textOverflow(page, '.action-bar__contact'),
        'texte du contact en trop',
      ).toBeLessThanOrEqual(0);
    });
  }
});
