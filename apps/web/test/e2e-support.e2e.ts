import { expect, test, type Page } from '@playwright/test';

import {
  analyzeWcag22AA,
  expectAxeClean,
  expectShellMounted,
  gotoMounted,
  STORAGE_KEY,
  storePreferences,
  tabsMode,
  waitForHydration,
  waitForSettledAnimations,
  WCAG_22_AA,
} from './support/e2e.js';

// Assistants communs des parcours (lot F11, F11-03, `test/support/e2e.ts`) : chacun est exercé ici,
// avec un témoin quand l'assistant doit pouvoir échouer ou ignorer quelque chose. Les animations sont
// créées par l'API Web Animations sur une page posée par `setContent` : durées et itérations exactes,
// sans dépendre des animations du site.

/** Animations lancées par `animate`, gardées par leur élément : une animation finie ou annulée sort
 * de `getAnimations()`, son état se lit alors sur la référence. */
interface AnimatedWindow {
  animations?: Record<string, Animation>;
}

/** État de lecture de l'animation lancée sur `#id` (`running`, `finished`, `idle` si annulée). */
async function playState(page: Page, id: string): Promise<string | undefined> {
  return page.evaluate((key) => (window as AnimatedWindow).animations?.[key]?.playState, id);
}

/** Lance sur `#id` une animation d'opacité (`iterations` : `Infinity` pour une animation infinie). */
async function animate(page: Page, id: string, duration: number, iterations = 1): Promise<void> {
  await page.evaluate(
    ({ key, duration, iterations }) => {
      const target = window as AnimatedWindow;
      const animation = document
        .getElementById(key)
        ?.animate([{ opacity: 0 }, { opacity: 1 }], { duration, iterations });
      if (animation !== undefined) target.animations = { ...target.animations, [key]: animation };
    },
    { key: id, duration, iterations },
  );
}

const ANIMATED_PAGE =
  '<html lang="fr"><head><title>t</title></head><body>' +
  '<div id="scope"><div id="child">a</div></div><div id="outside">b</div><div id="loop">c</div>' +
  '</body></html>';

test.describe('axe', () => {
  test('WCAG_22_AA : critères A et AA des WCAG 2.0, 2.1 et 2.2, tableau figé', () => {
    expect(WCAG_22_AA).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
    expect(Object.isFrozen(WCAG_22_AA)).toBe(true);
  });

  test('analyzeWcag22AA rend les violations d’une page non conforme (témoin)', async ({ page }) => {
    await page.setContent(
      '<html><head><title>t</title></head><body><main><h1>Titre</h1>' +
        '<p style="color:#aaa;background:#fff">Texte peu lisible</p>' +
        '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main></body></html>',
    );

    const results = await analyzeWcag22AA(page);

    expect(results.violations.map((violation) => violation.id).sort()).toEqual([
      'color-contrast',
      'html-has-lang',
      'image-alt',
    ]);
  });

  test('expectAxeClean : la page d’accueil montée est conforme, contraste mesuré', async ({
    page,
  }) => {
    await gotoMounted(page, '/');

    const results = await expectAxeClean(page, 'accueil');

    expect(results.violations).toEqual([]);
    expect(results.passes.map((rule) => rule.id)).toContain('color-contrast');
  });

  test('expectAxeClean échoue sur une violation, et sur une page sans contraste mesuré', async ({
    page,
  }) => {
    await page.setContent(
      '<html><head><title>t</title></head><body><main><h1>Titre</h1></main></body></html>',
    );
    await expect(expectAxeClean(page, 'sans lang')).rejects.toThrow('sans lang');

    await page.setContent('<html lang="fr"><head><title>t</title></head><body></body></html>');
    expect((await analyzeWcag22AA(page)).violations).toEqual([]);
    await expect(expectAxeClean(page, 'aucun texte')).rejects.toThrow('aucun texte');
  });
});

test.describe('préférences et coquille', () => {
  test('storePreferences : préférences lues au démarrage, sous STORAGE_KEY, au format version 1', async ({
    page,
  }) => {
    await storePreferences(page, { theme: 'sombre', textSize: 130 });
    await gotoMounted(page, '/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sombre');
    await expect(page.locator('html')).toHaveAttribute('data-text-size', '130');
    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(JSON.parse(stored ?? 'null')).toMatchObject({
      version: 1,
      theme: 'sombre',
      textSize: 130,
    });
  });

  test('tabsMode suit le mode choisi par la coquille à la taille du projet', async ({ page }) => {
    await gotoMounted(page, '/');

    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-mode',
      tabsMode(page) ? 'tabs' : 'mosaic',
    );
  });

  test('gotoMounted : rend la réponse, application hydratée au retour ; options transmises', async ({
    page,
  }) => {
    const response = await gotoMounted(page, '/en', { waitUntil: 'networkidle' });

    expect(response?.status()).toBe(200);
    expect(
      await page.evaluate(
        () =>
          document.querySelector<Element & { __vue_app__?: unknown }>('#__nuxt')?.__vue_app__ !==
          undefined,
      ),
    ).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('expectShellMounted : attend le montage après une navigation dans l’application', async ({
    page,
  }) => {
    await gotoMounted(page, '/');
    await page.locator('.language-switch a[hreflang="en"]').click();
    await expect(page).toHaveURL('/en');

    await expectShellMounted(page);
    await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
  });

  test('waitForHydration : application montée sur une page annexe, sans coquille', async ({
    page,
  }) => {
    await page.goto('/accessibilite');

    await waitForHydration(page);

    await expect(page.locator('.app-shell')).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          document.querySelector<Element & { __vue_app__?: unknown }>('#__nuxt')?.__vue_app__ !==
          undefined,
      ),
    ).toBe(true);
  });
});

test.describe('waitForSettledAnimations', () => {
  test('document : attend les animations finies, ignore une animation infinie', async ({
    page,
  }) => {
    await page.setContent(ANIMATED_PAGE);
    await animate(page, 'child', 400);
    await animate(page, 'loop', 200, Infinity);
    expect(await playState(page, 'child')).toBe('running');

    await waitForSettledAnimations(page);

    expect(await playState(page, 'child')).toBe('finished');
    expect(await playState(page, 'loop')).toBe('running');
  });

  test('scope : attend l’élément et ses descendants, pas le reste de la page', async ({ page }) => {
    await page.setContent(ANIMATED_PAGE);
    await animate(page, 'child', 400);
    await animate(page, 'outside', 20_000);
    await animate(page, 'loop', 200, Infinity);

    await waitForSettledAnimations(page, page.locator('#scope'));

    expect(await playState(page, 'child')).toBe('finished');
    expect(await playState(page, 'outside')).toBe('running');
  });

  test('une animation annulée pendant l’attente ne la fait ni échouer ni durer', async ({
    page,
  }) => {
    await page.setContent(ANIMATED_PAGE);
    // Plus longue que le délai du test : seule l'annulation peut terminer l'attente à temps.
    await animate(page, 'child', 60_000);
    await page.evaluate(() => {
      const animation = (window as AnimatedWindow).animations?.['child'];
      setTimeout(() => animation?.cancel(), 300);
    });

    await waitForSettledAnimations(page);

    expect(await playState(page, 'child')).toBe('idle');
  });
});
