import { expect, test, type Page } from '@playwright/test';

import { storePreferences, waitForSettledAnimations } from './support/e2e.js';

// Reflow à 400 % de zoom (WCAG 1.4.10, constat RA-1) : une fenêtre de 320 px de large et de 256 ou 200 px
// de haut (zoom de 400 % d'un écran de 1280 × 1024) ne peut pas contenir l'en-tête, le filtre, la barre
// d'actions et la navigation du bas en plus d'une liste lisible. Sous un seuil de hauteur la page défile :
// l'en-tête, la barre d'actions et le filtre sont statiques, la navigation du bas reste seule fixe, la
// liste de l'XP est visible et rien ne déborde horizontalement.

/** Hauteur visible minimale de la liste de l'XP : trois lignes de texte d'au moins 20 px. */
const MIN_VISIBLE_LIST = 60;

const LOCALES = {
  fr: { path: '/', nav: 'Sections', xp: 'XP' },
  en: { path: '/en', nav: 'Sections', xp: 'XP' },
} as const;

const SIZES = [
  { width: 320, height: 256 },
  { width: 320, height: 200 },
] as const;

async function open(page: Page, path: string, textSize: number): Promise<void> {
  await storePreferences(page, { theme: 'clair', textSize });
  await page.goto(path);
  await expect(page.locator('.app-shell[data-mode="tabs"]')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-text-size', String(textSize));
}

for (const code of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
  const locale = LOCALES[code];
  for (const size of SIZES) {
    for (const textSize of [100, 130]) {
      const label = `${code} ${size.width} × ${size.height}, texte ${textSize} %`;

      test.describe(label, () => {
        test.use({ viewport: size });

        test('la page défile : en-tête et barre d’actions statiques, navigation seule fixe', async ({
          page,
        }) => {
          await open(page, locale.path, textSize);
          const header = page.locator('.mobile-header');
          const actions = page.locator('.action-bar');
          const nav = page.getByRole('navigation', { name: locale.nav });
          await waitForSettledAnimations(page);

          const scrollable = await page.evaluate(
            () => document.documentElement.scrollHeight - window.innerHeight,
          );
          expect(scrollable, 'la page défile').toBeGreaterThan(40);

          const before = {
            header: (await header.boundingBox())!.y,
            actions: (await actions.boundingBox())!.y,
            nav: (await nav.boundingBox())!.y,
          };
          await page.evaluate(() => window.scrollTo(0, 40));
          const after = {
            header: (await header.boundingBox())!.y,
            actions: (await actions.boundingBox())!.y,
            nav: (await nav.boundingBox())!.y,
          };
          expect(after.header, 'l’en-tête défile avec la page').toBe(before.header - 40);
          expect(after.actions, 'la barre d’actions défile avec la page').toBe(before.actions - 40);
          expect(after.nav, 'la navigation du bas reste fixe').toBe(before.nav);
        });

        test('la liste de l’XP est visible et rien ne déborde horizontalement', async ({
          page,
        }) => {
          await open(page, locale.path, textSize);
          const nav = page.getByRole('navigation', { name: locale.nav });
          await nav.getByRole('button', { name: locale.xp, exact: true }).click();
          await waitForSettledAnimations(page);

          // Le haut de la liste au haut de la fenêtre : la part visible, sous la navigation fixe.
          await page.evaluate(() => {
            const region = document.querySelector('.experience-section__list')!;
            window.scrollTo(0, region.getBoundingClientRect().top + window.scrollY);
          });
          const visible = await page.evaluate(() => {
            const region = document
              .querySelector('.experience-section__list')!
              .getBoundingClientRect();
            const bar = document.querySelector('nav.bottom-nav')!.getBoundingClientRect();
            return Math.min(region.bottom, bar.top) - Math.max(region.top, 0);
          });
          expect(visible, 'hauteur visible de la liste de l’XP').toBeGreaterThanOrEqual(
            MIN_VISIBLE_LIST,
          );

          // Le débordement du titre du Profil à 320 px (RA-3) a son parcours (title-overflow.e2e.ts).
          const overflow = await page.evaluate(() => {
            const root = document.documentElement;
            return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
          });
          expect(overflow, 'onglet XP : largeur de page en trop').toBeLessThanOrEqual(0);
        });
      });
    }
  }
}
