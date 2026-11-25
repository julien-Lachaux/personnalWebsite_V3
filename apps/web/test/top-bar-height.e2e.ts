import { expect, test, type Page } from '@playwright/test';

// F12-BARRE : à partir de 1024 px, la barre du haut du bureau tient sur une ligne dans les deux
// langues (« Start the interview » et « CV PDF (in French) » sont plus larges que leurs équivalents
// français). Mesures dans le navigateur : hauteur de la barre, et ordonnée de chaque onglet, qui ne
// doit pas se replier sous les autres. Vérifié à 1024 et 1280 px ; les autres projets n'ont rien à
// comparer (barre mobile sous 1024 px, marges plus larges au-delà).

const WIDTHS = [1024, 1280];

async function measure(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
  const bar = page.locator('.top-bar');
  await expect(bar).toBeVisible();
  const box = await bar.boundingBox();
  const tabs = await bar
    .locator('.top-bar__tab')
    .evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().top)),
    );
  const overflow = await bar.evaluate((element) => element.scrollWidth - element.clientWidth);
  return { height: box!.height, tabs, overflow };
}

test.describe('barre du haut du bureau (F12-BARRE)', () => {
  test('même hauteur et une seule ligne en français et en anglais', async ({ page }) => {
    if (!WIDTHS.includes(page.viewportSize()!.width)) return;

    const fr = await measure(page, '/');
    const en = await measure(page, '/en');

    expect(en.height, `hauteur fr ${fr.height}, en ${en.height}`).toBe(fr.height);
    expect(new Set(fr.tabs).size, `onglets fr ${fr.tabs.join()}`).toBe(1);
    expect(new Set(en.tabs).size, `onglets en ${en.tabs.join()}`).toBe(1);
    expect(fr.overflow).toBeLessThanOrEqual(0);
    expect(en.overflow).toBeLessThanOrEqual(0);
  });
});
