import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Page « panne du serveur » (D48, lot 35), à chaque taille d'écran des maquettes, en fr et en, schémas
// clair et sombre. Complète test/server-error.e2e.ts (mécanisme du lot 30 : page sans application,
// CSP, plan du site) sur ce que la refonte ajoute :
// - « Réessayer » a l'apparence d'un bouton plein du site (feuille de style de `LinkButton` présente
//   dans la page autonome), reste un lien vers l'adresse servie et tient la cible tactile (D17) ;
// - titre, paragraphes et bouton ne coupent aucun mot et ne débordent pas, dès 390 px ;
// - l'ordre du clavier mène au bouton, dont le focus est visible ; axe WCAG 2.2 AA.
// Le proxy sert `50x.html` (ou `en/50x.html` sous /en) à l'adresse demandée avec le statut d'erreur ;
// `page.route` le reproduit.

const PUBLIC_DIR = resolve(import.meta.dirname, '../.output/public');
const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** `--accent` (fond du bouton plein) et `--on` (son texte) de tokens.css, sans réglage enregistré. */
const SOLID = {
  light: { background: 'rgb(31, 92, 77)', color: 'rgb(255, 255, 255)' },
  dark: { background: 'rgb(127, 209, 181)', color: 'rgb(16, 26, 33)' },
} as const;

const PAGES = [
  {
    locale: 'fr',
    file: '50x.html',
    path: '/une-page?vue=1',
    status: 503,
    title: 'Le serveur est en panne pour l’instant',
    retry: 'Réessayer',
  },
  {
    locale: 'en',
    file: 'en/50x.html',
    path: '/en/some-page',
    status: 502,
    title: 'The server is temporarily down',
    retry: 'Try again',
  },
] as const;

type OutagePage = (typeof PAGES)[number];

async function serveOutage(page: Page, { file, path, status }: OutagePage): Promise<void> {
  const body = readFileSync(join(PUBLIC_DIR, file));
  const pathname = new URL(path, 'http://localhost').pathname;
  await page.route(
    (url) => url.pathname === pathname,
    (route) => route.fulfill({ status, contentType: 'text/html; charset=utf-8', body }),
  );
}

/**
 * Mots coupés en fin de ligne dans les textes de `selector` : un passage à la ligne entre deux
 * caractères qui ne sont pas des espaces (mesuré caractère par caractère, `Range.getClientRects`).
 */
async function brokenWords(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((target) => {
    const broken: string[] = [];
    for (const element of document.querySelectorAll(target)) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        const range = document.createRange();
        let previousTop: number | null = null;
        for (let index = 0; index < text.length; index += 1) {
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const rect = range.getClientRects()[0];
          if (rect === undefined || /\s/.test(text[index] ?? '')) continue;
          if (
            previousTop !== null &&
            rect.top > previousTop + 1 &&
            index > 0 &&
            !/\s/.test(text[index - 1] ?? '')
          ) {
            broken.push(
              `${text.slice(Math.max(0, index - 12), index)}|${text.slice(index, index + 12)}`,
            );
          }
          previousTop = rect.top;
        }
      }
    }
    return broken;
  }, selector);
}

/** Plus grand dépassement (px) d'un texte de `selector` hors de la fenêtre `>_` qui le porte. */
async function textOverflow(page: Page, selector: string): Promise<number> {
  return page.evaluate((target) => {
    const window_ = document.querySelector<HTMLElement>('.annex-page__window')!;
    const box = window_.getBoundingClientRect();
    let worst = window_.scrollWidth - window_.clientWidth;
    for (const element of document.querySelectorAll(target)) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          worst = Math.max(worst, rect.right - box.right, box.left - rect.left);
        }
      }
    }
    return worst;
  }, selector);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`page « panne du serveur » sans JavaScript, schéma ${colorScheme}`, () => {
    test.use({ colorScheme, javaScriptEnabled: false });

    for (const expected of PAGES) {
      test(`${expected.locale} : « ${expected.retry} » en bouton plein, textes sans mot coupé`, async ({
        page,
      }, testInfo) => {
        await serveOutage(page, expected);

        const response = await page.goto(expected.path);

        expect(response?.status()).toBe(expected.status);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected.title);
        await expect(page.locator('main#contenu')).toContainText('>_ panne-serveur.log');
        const retry = page.getByRole('main').getByRole('link', { name: expected.retry });
        await expect(retry).toHaveAttribute('href', '');
        await expect(retry).toHaveClass(/\bbase-button--solid\b/);
        // Apparence du bouton plein : la feuille de style de LinkButton est bien servie avec la page.
        const style = await retry.evaluate((node) => {
          const computed = getComputedStyle(node);
          return {
            background: computed.backgroundColor,
            color: computed.color,
            decoration: computed.textDecorationLine,
          };
        });
        expect(style).toEqual({ ...SOLID[colorScheme], decoration: 'none' });
        const box = await retry.boundingBox();
        const width = testInfo.project.use.viewport?.width ?? 0;
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(width < 1024 ? 44 : 24);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);

        const texts = '.annex-page__body h1, .annex-page__body p, .annex-page__body a';
        expect(await brokenWords(page, texts), 'mots coupés').toEqual([]);
        expect(await textOverflow(page, texts), 'texte hors de la fenêtre').toBeLessThanOrEqual(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      });
    }
  });

  test.describe(`page « panne du serveur » au clavier, schéma ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const expected of PAGES) {
      test(`${expected.locale} : le clavier atteint « ${expected.retry} », focus visible, axe`, async ({
        page,
      }) => {
        await serveOutage(page, expected);
        await page.goto(expected.path, { waitUntil: 'networkidle' });

        const retry = page.getByRole('main').getByRole('link', { name: expected.retry });
        let reached = false;
        for (let step = 0; step < 6 && !reached; step += 1) {
          await page.keyboard.press('Tab');
          reached = await retry.evaluate((node) => node === document.activeElement);
        }
        expect(reached, 'bouton atteint au clavier').toBe(true);
        expect(await retry.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe('solid');

        const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
        expect(results.violations).toEqual([]);
        expect(results.passes.length).toBeGreaterThan(0);
      });
    }
  });
}
