import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, test, type Page, type Request } from '@playwright/test';

import { buildPolicy, collectHashes } from '../../../scripts/deploy/csp-hashes.mjs';
import { analyzeWcag22AA } from './support/e2e.js';

// Pages d'erreur serveur (lot 30), à chaque taille d'écran des maquettes, en fr et en, schémas clair et
// sombre. Le proxy de production sert `50x.html` (ou `en/50x.html` sous /en) à l'adresse demandée, avec
// le statut 500, 502, 503 ou 504 ; `page.route` le reproduit ici. Quand cette page est servie, le
// serveur ou l'API peuvent être en panne : elle s'affiche sans JavaScript, ne demande que les feuilles
// de style et les polices du site, tient sous la CSP stricte du déploiement, n'est pas indexable et
// n'entre pas dans le plan du site.

const PUBLIC_DIR = resolve(import.meta.dirname, '../.output/public');

/** Fond de la page (`--bg` de tokens.css) dans chaque schéma, sans réglage enregistré. */
const BACKGROUND = { light: 'rgb(230, 235, 229)', dark: 'rgb(16, 26, 33)' } as const;
/** Valeur de `data-theme` posée par le script de thème selon le schéma du système. */
const THEME = { light: 'clair', dark: 'sombre' } as const;

const PAGES = [
  {
    locale: 'fr',
    file: '50x.html',
    path: '/une-page?vue=1',
    status: 503,
    title: 'Le serveur est en panne pour l’instant',
    text: 'Le site ne peut pas s’afficher pour le moment.',
    retry: 'Réessayer',
    back: 'Retour à l’accueil',
    home: '/',
    skip: 'Aller au contenu',
  },
  {
    locale: 'fr',
    file: '50x.html',
    path: '/accessibilite?section=2',
    status: 502,
    title: 'Le serveur est en panne pour l’instant',
    text: 'Le site ne peut pas s’afficher pour le moment.',
    retry: 'Réessayer',
    back: 'Retour à l’accueil',
    home: '/',
    skip: 'Aller au contenu',
  },
  {
    locale: 'en',
    file: 'en/50x.html',
    path: '/en/some-page',
    status: 504,
    title: 'The server is temporarily down',
    text: 'The site can’t be displayed right now.',
    retry: 'Try again',
    back: 'Back to the home page',
    home: '/en',
    skip: 'Skip to content',
  },
  {
    locale: 'en',
    file: 'en/50x.html',
    path: '/en',
    status: 500,
    title: 'The server is temporarily down',
    text: 'The site can’t be displayed right now.',
    retry: 'Try again',
    back: 'Back to the home page',
    home: '/en',
    skip: 'Skip to content',
  },
] as const;

type ServerErrorPage = (typeof PAGES)[number];

/** Sert la page d'erreur de la langue à l'adresse demandée, avec le statut et la politique donnés. */
async function serveError(
  page: Page,
  { file, path, status }: ServerErrorPage,
  headers: Record<string, string> = {},
): Promise<Request[]> {
  const served: Request[] = [];
  const body = readFileSync(join(PUBLIC_DIR, file));
  const pathname = new URL(path, 'http://localhost').pathname;
  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      served.push(route.request());
      await route.fulfill({ status, contentType: 'text/html; charset=utf-8', headers, body });
    },
  );
  return served;
}

/** Ressources demandées par la page, hors du document servi par `serveError`. */
function watchRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() !== 'document') {
      requested.push(`${request.resourceType()} ${new URL(request.url()).pathname}`);
    }
  });
  return requested;
}

/**
 * Vérifie le contenu, la structure et le référencement de la page affichée ; axe en plus quand
 * JavaScript est actif (axe s'exécute dans la page : sans JavaScript, il ne peut pas tourner ; la page
 * n'étant jamais hydratée, son document est le même dans les deux cas).
 */
async function expectServerErrorPage(
  page: Page,
  expected: ServerErrorPage,
  { axe }: { axe: boolean },
): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', expected.locale);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected.title);
  await expect(page).toHaveTitle(expected.title);
  const main = page.locator('main#contenu');
  await expect(main).toHaveCount(1);
  await expect(main).toContainText(expected.text);
  await expect(main).toContainText('>_ panne-serveur.log');
  // Message générique : ni le code de la réponse, ni un détail technique.
  await expect(main).not.toContainText(String(expected.status));
  await expect(page.locator('a, button').first()).toHaveText(expected.skip);
  await expect(page.locator('a, button').first()).toHaveAttribute('href', '#contenu');
  // En-tête du site sans contrôles (ils demandent JavaScript) : le seul lien vers l'accueil.
  const banner = page.getByRole('banner');
  await expect(banner.getByRole('button')).toHaveCount(0);
  await expect(banner.getByRole('link')).toHaveCount(1);
  await expect(banner.getByRole('link')).toHaveAttribute('href', expected.home);
  await expect(main.getByRole('link', { name: expected.back })).toHaveAttribute(
    'href',
    expected.home,
  );
  await expect(main.getByRole('link', { name: expected.retry })).toHaveAttribute('href', '');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('link[rel="alternate"]')).toHaveCount(0);
  // Rien ne déborde horizontalement, quelle que soit la largeur.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  if (!axe) return;
  const results = await analyzeWcag22AA(page);
  expect(results.violations).toEqual([]);
  expect(results.passes.length).toBeGreaterThan(0);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`page d’erreur serveur sans JavaScript, schéma ${colorScheme}`, () => {
    test.use({ colorScheme, javaScriptEnabled: false });

    for (const expected of PAGES) {
      test(`${expected.status} à ${expected.path} (${expected.locale}) : page complète, thème du système`, async ({
        page,
      }) => {
        const served = await serveError(page, expected);
        const requested = watchRequests(page);

        const response = await page.goto(expected.path);

        expect(response?.status()).toBe(expected.status);
        await expect(page).toHaveURL(expected.path);
        await expectServerErrorPage(page, expected, { axe: false });
        // Sans le script de thème, le thème suit `prefers-color-scheme` (tokens.css).
        await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
        expect(
          await page
            .locator('.annex-layout')
            .evaluate((node) => getComputedStyle(node).backgroundColor),
        ).toBe(BACKGROUND[colorScheme]);
        // Seules les feuilles de style et les polices du site : aucun script, aucun appel à l'API.
        await page.waitForLoadState('networkidle');
        expect(requested.length).toBeGreaterThan(0);
        for (const request of requested) {
          expect(request).toMatch(
            /^(?:stylesheet \/_nuxt\/[\w.-]+\.css|font \/fonts\/[\w/.-]+\.woff2)$/,
          );
        }

        // « Réessayer » redemande l'adresse servie ; le retour mène à l'accueil.
        await page.getByRole('main').getByRole('link', { name: expected.retry }).click();
        await expect.poll(() => served.length).toBe(2);
        expect(served[1]?.url()).toBe(served[0]?.url());
        await expect(page).toHaveURL(expected.path);
        await page.unrouteAll();
        await page.getByRole('main').getByRole('link', { name: expected.back }).click();
        await expect(page).toHaveURL(expected.home);
      });
    }
  });

  test.describe(`page d’erreur serveur avec JavaScript, schéma ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const expected of PAGES) {
      test(`${expected.status} à ${expected.path} (${expected.locale}) : script de thème seul, jamais hydratée`, async ({
        page,
      }) => {
        await serveError(page, expected);
        const requested = watchRequests(page);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(String(error)));

        await page.goto(expected.path, { waitUntil: 'networkidle' });

        await expectServerErrorPage(page, expected, { axe: true });
        // Le script de thème (D5) a posé le thème du système ; l'application n'a pas démarré.
        await expect(page.locator('html')).toHaveAttribute('data-theme', THEME[colorScheme]);
        expect(
          await page.evaluate(() => {
            const root = document.querySelector<Element & { __vue_app__?: unknown }>('#__nuxt');
            return { config: '__NUXT__' in window, hydrated: root?.__vue_app__ !== undefined };
          }),
        ).toEqual({ config: false, hydrated: false });
        expect(requested.filter((request) => !/^(?:stylesheet|font) /.test(request))).toEqual([]);
        expect(errors).toEqual([]);
      });
    }

    test('réglages enregistrés appliqués hors ligne (thème inverse, contraste renforcé)', async ({
      page,
    }) => {
      const expected = PAGES[0];
      const theme = colorScheme === 'dark' ? 'clair' : 'sombre';
      await page.addInitScript(
        (stored) => {
          localStorage.setItem('siteperso:preferences', stored);
        },
        JSON.stringify({
          version: 1,
          theme,
          textSize: 130,
          highContrast: true,
          readableFont: false,
          textSpacing: false,
          underlineLinks: false,
          reduceMotion: false,
        }),
      );
      await serveError(page, expected);

      await page.goto(expected.path);

      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).toHaveAttribute('data-contrast', 'renforce');
      await expect(page.locator('html')).toHaveAttribute('data-text-size', '130');
      const results = await analyzeWcag22AA(page);
      expect(results.violations).toEqual([]);
    });
  });
}

// CSP stricte du déploiement : la politique de scripts/deploy/csp-hashes.mjs (RC-8, D40), avec les
// empreintes de tous les éléments en ligne des pages générées.

function strictPolicy(): string {
  return buildPolicy(collectHashes(PUBLIC_DIR));
}

test.describe('page d’erreur serveur sous la CSP stricte', () => {
  for (const expected of [PAGES[0], PAGES[2]]) {
    test(`${expected.file} : aucune violation ni erreur de console`, async ({ page }) => {
      await serveError(page, expected, { 'content-security-policy': strictPolicy() });
      await page.addInitScript(() => {
        const seen: string[] = [];
        Object.defineProperty(window, '__cspViolations', { value: seen });
        document.addEventListener('securitypolicyviolation', (event) => {
          seen.push(`${event.violatedDirective} bloque ${event.blockedURI || 'en ligne'}`);
        });
      });
      const errors: string[] = [];
      page.on('console', (message) => {
        // Le navigateur journalise le statut d'erreur du document : c'est le statut attendu.
        if (
          /^Failed to load resource: the server responded with a status of 5\d\d\b/.test(
            message.text(),
          )
        )
          return;
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(String(error)));

      await page.goto(expected.path, { waitUntil: 'networkidle' });

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected.title);
      await expect(page.locator('html')).toHaveAttribute('data-theme', /^(clair|sombre)$/);
      expect(
        await page.evaluate(
          () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
        ),
      ).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  // Témoin : sans les empreintes, le script de thème et les styles en ligne de la page sont bloqués.
  test('témoin : une politique sans empreintes bloque le script de thème', async ({ page }) => {
    const policy = strictPolicy()
      .replace(/script-src [^;]+/, "script-src 'self'")
      .replace(/style-src [^;]+/, "style-src 'self'");
    await serveError(page, PAGES[0], { 'content-security-policy': policy });

    await page.goto(PAGES[0].path, { waitUntil: 'networkidle' });

    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  });
});

test('le plan du site ne contient pas les pages d’erreur serveur', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  expect(xml).toContain('<loc>');
  expect(xml).not.toContain('50x');
});

test('la page anglaise ne contient aucun libellé de la page française', () => {
  const english = readFileSync(join(PUBLIC_DIR, 'en/50x.html'), 'utf8');
  for (const label of [
    'Le serveur est en panne pour l’instant',
    'Réessayer',
    'Retour à l’accueil',
    'Aller au contenu',
    '(accueil)',
  ]) {
    expect(english).not.toContain(label);
  }
});
