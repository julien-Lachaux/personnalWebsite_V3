import { expect, test, type Locator, type Page } from '@playwright/test';

import { gotoMounted } from './support/e2e.js';

// D43 (lot F12) : le séparateur de « FR | EN » ne bouge pas au changement de langue et la langue
// courante prend la couleur d'accent ; D41 : le texte du Profil a la taille de celui de la section IA.
// Mesures dans le navigateur (boîtes et styles calculés), à la taille de chaque projet : 1280 (bureau) et
// 390 (mobile) en particulier. Preuves de comportement, sans lecture du source CSS.

function switcher(page: Page): Locator {
  return page.locator('.language-switch:visible').first();
}

async function separatorBox(page: Page, path: string) {
  await gotoMounted(page, path);
  const separator = switcher(page).locator('.language-switch__separator');
  await expect(separator).toBeVisible();
  const box = await separator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test.describe('sélecteur de langue (D43)', () => {
  test('le séparateur garde la même position et la même largeur entre / et /en', async ({
    page,
  }) => {
    const fr = await separatorBox(page, '/');
    const en = await separatorBox(page, '/en');

    expect(en.width).toBeCloseTo(fr.width, 1);
    expect(en.x).toBeCloseTo(fr.x, 1);
    expect(en.y).toBeCloseTo(fr.y, 1);
  });

  test('la langue courante prend la couleur calculée de --accent', async ({ page }) => {
    for (const path of ['/', '/en']) {
      await gotoMounted(page, path);
      const current = switcher(page).locator('[aria-current="true"]');
      await expect(current).toBeVisible();

      const { actual, accent } = await current.evaluate((element) => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--accent)';
        element.parentElement!.append(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return { actual: getComputedStyle(element).color, accent: resolved };
      });

      expect(actual, path).toBe(accent);
      // Témoin : la couleur du texte ordinaire n'est pas l'accent.
      const text = await page.locator('body').evaluate((body) => getComputedStyle(body).color);
      expect(text).not.toBe(accent);
    }
  });
});

test.describe('tailles de texte du Profil et de l’IA (D41)', () => {
  test('le texte du Profil a la taille calculée de celui de la section IA', async ({ page }) => {
    // Sous 1024 px, une seule section est affichée à la fois : rien à comparer.
    if (page.viewportSize()!.width < 1024) return;
    await page.goto('/');
    await expect(page.locator('.app-shell[data-mode="mosaic"]')).toHaveCount(1);

    const size = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).fontSize);

    const intro = await size('.profile__intro');
    expect(await size('.profile__mission')).toBe(intro);
    expect(await size('.ai__text')).toBe(intro);
    expect(await size('.ai__list')).toBe(intro);
  });
});
