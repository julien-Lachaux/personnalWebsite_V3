import { expect, test, type Page } from '@playwright/test';

// Texte agrandi à 130 % (SPEC § 10.1, WCAG 1.4.4 et 1.4.10) à chaque taille d'écran, en français et en
// anglais : la page ne déborde pas horizontalement (`scrollWidth` de la page entière), sous 1024 px à
// chaque onglet, au-delà dans la mosaïque puis dans chaque tuile agrandie. Le contenu rogné à l'intérieur
// d'un conteneur (texte tronqué) a ses tests ciblés dans defects-f8.e2e.ts.

const STORAGE_KEY = 'siteperso:preferences';

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

const SECTIONS = ['profile', 'experience', 'recommendations', 'ai'] as const;

function tabsMode(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getComputedTiming().endTime === Infinity,
      ),
  );
}

/** Largeur de la page en trop par rapport à la fenêtre (`scrollWidth` de la page entière). */
async function pageOverflow(page: Page): Promise<number> {
  await settled(page);
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
  });
}

async function expectNoPageOverflow(page: Page, label: string): Promise<void> {
  expect(await pageOverflow(page), `${label} : largeur de page en trop`).toBeLessThanOrEqual(0);
}

for (const code of Object.keys(LOCALES) as LocaleCode[]) {
  const locale = LOCALES[code];

  test(`${code} : texte à 130 %, la page ne déborde pas horizontalement`, async ({ page }) => {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: STORAGE_KEY,
      value: JSON.stringify({ version: 1, theme: 'clair', textSize: 130 }),
    });
    await page.goto(locale.path);
    await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('data-text-size', '130');

    if (tabsMode(page)) {
      const nav = page.getByRole('navigation', { name: locale.nav });
      for (const [index, name] of locale.tabs.entries()) {
        await nav.getByRole('button', { name, exact: true }).click();
        await expect(page.locator(`#section-${SECTIONS[index]}`)).toBeVisible();
        await expectNoPageOverflow(page, `onglet ${name}`);
      }
      return;
    }

    await expect(page.locator('.tile-grid:not(.tile-grid--instant)')).toHaveCount(1);
    await expectNoPageOverflow(page, 'mosaïque');
    for (const id of SECTIONS) {
      const tile = page.locator(`[data-tile="${id}"]`);
      await tile.getByRole('button', { name: locale.expand }).click();
      await expect(tile).toHaveClass(/tile-grid__tile--expanded/);
      await expectNoPageOverflow(page, `tuile ${id} agrandie`);
      await tile.getByRole('button', { name: locale.collapse }).click();
      await expect(page.locator('.tile-grid__tile--expanded')).toHaveCount(0);
    }
  });
}
