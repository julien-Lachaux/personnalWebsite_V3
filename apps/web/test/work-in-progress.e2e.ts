import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Page « travaux en cours » (lot 31), à chaque taille d'écran des maquettes, en clair et en sombre,
// en français et en anglais :
// - message, contact (mailto de la configuration, adresse non affichée), CV PDF (repli sur le CV
//   français tant que le CV anglais manque), en-tête des pages annexes (langue, thème), axe ;
// - hors index : `noindex`, ni canonique ni hreflang, absente de `sitemap.xml` ;
// - servie telle quelle quel que soit le statut HTTP (le proxy du lot 32 peut la servir en 503) ;
// - sous la CSP stricte du déploiement (empreintes recalculées sur les pages générées, comme
//   test/csp.e2e.ts), sans violation ni erreur de console.

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PUBLIC_DIR = resolve(import.meta.dirname, '../.output/public');

const PAGES = [
  {
    locale: 'fr',
    path: '/travaux',
    file: 'travaux/index.html',
    other: '/en/work-in-progress',
    languageLink: 'EN',
    title: 'Site en cours de construction',
    contact: 'Lancer l’entretien',
    subject: 'Prise de contact depuis votre site',
    cv: 'CV PDF',
    cvLanguage: null,
  },
  {
    locale: 'en',
    path: '/en/work-in-progress',
    file: 'en/work-in-progress/index.html',
    other: '/travaux',
    languageLink: 'FR',
    title: 'Site under construction',
    contact: 'Start the interview',
    subject: 'Getting in touch from your website',
    cv: 'CV PDF (in French)',
    cvLanguage: 'fr',
  },
] as const;

/** Attend l'hydratation (application Vue montée sur #__nuxt). */
async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector<Element & { __vue_app__?: unknown }>('#__nuxt');
    return root?.__vue_app__ !== undefined;
  });
}

async function axe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  expect(results.violations).toEqual([]);
  expect(results.passes.length).toBeGreaterThan(0);
}

/** Méta de référencement de la page courante. */
async function seo(page: Page) {
  return page.evaluate(() => ({
    title: document.title,
    robots: document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
    ogUrl: document.head.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? null,
    canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    alternates: document.head.querySelectorAll('link[rel="alternate"][hreflang]').length,
  }));
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`page « travaux en cours », schéma ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const wip of PAGES) {
      test(`${wip.path} (${wip.locale}) : message, contact, CV, hors index, axe`, async ({
        page,
      }) => {
        const response = await page.goto(wip.path);
        expect(response?.status()).toBe(200);
        await hydrated(page);

        await expect(page.locator('html')).toHaveAttribute('lang', wip.locale);
        await expect(page.locator('html')).toHaveAttribute('data-theme', /^(clair|sombre)$/);
        await expect(page.locator('a, button').first()).toHaveClass(/skip-link/);
        await expect(page.getByRole('banner')).toHaveCount(1);
        await expect(page.locator('main#contenu')).toHaveCount(1);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(wip.title);

        // Deux liens seulement dans le contenu : contact puis CV (pas de retour à l'accueil).
        const main = page.getByRole('main');
        await expect(main.getByRole('link')).toHaveCount(2);
        await expect(main.getByRole('link', { name: wip.contact })).toHaveAttribute(
          'href',
          `mailto:contact@example.org?subject=${encodeURIComponent(wip.subject)}`,
        );
        await expect(main).not.toContainText('contact@example.org');
        const cv = main.getByRole('link', { name: wip.cv, exact: true });
        await expect(cv).toHaveAttribute('href', '/cv/cv-fr.pdf');
        await expect(cv).toHaveAttribute('type', 'application/pdf');
        if (wip.cvLanguage === null) await expect(cv).not.toHaveAttribute('hreflang');
        else await expect(cv).toHaveAttribute('hreflang', wip.cvLanguage);
        expect((await page.request.get('/cv/cv-fr.pdf')).status()).toBe(200);

        // Hors index : ni canonique ni hreflang ni og:url.
        expect(await seo(page)).toEqual({
          title: wip.title,
          robots: 'noindex',
          ogUrl: null,
          canonical: null,
          alternates: 0,
        });

        // Rien ne déborde horizontalement, à aucune taille d'écran.
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true);

        await axe(page);

        // Le thème bascule depuis l'en-tête, puis la même page dans l'autre langue.
        const theme = await page.locator('html').getAttribute('data-theme');
        await page
          .getByRole('banner')
          .getByRole('button', { name: /^(Thème (sombre|clair)|(Dark|Light) theme),/ })
          .click();
        await expect(page.locator('html')).not.toHaveAttribute('data-theme', theme ?? '');
        await page
          .getByRole('banner')
          .getByRole('link', { name: wip.languageLink, exact: true })
          .click();
        await expect(page).toHaveURL(wip.other);
        await expect(page.locator('html')).not.toHaveAttribute('lang', wip.locale);
        expect((await seo(page)).canonical).toBeNull();
      });

      test(`${wip.path} (${wip.locale}) : servie en 503 par le proxy, affichée telle quelle`, async ({
        page,
      }) => {
        const body = readFileSync(join(PUBLIC_DIR, wip.file), 'utf8');
        await page.route(`**${wip.path}`, (route) =>
          route.fulfill({
            status: 503,
            contentType: 'text/html; charset=utf-8',
            headers: { 'retry-after': '3600' },
            body,
          }),
        );

        const response = await page.goto(wip.path);
        expect(response?.status()).toBe(503);
        await hydrated(page);

        await expect(page).toHaveURL(wip.path);
        await expect(page.locator('html')).toHaveAttribute('lang', wip.locale);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(wip.title);
        await expect(page.getByRole('main').getByRole('link')).toHaveCount(2);
        await axe(page);
      });
    }
  });
}

test('sitemap.xml ne mentionne pas la page « travaux en cours »', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();

  expect(xml).toContain('<loc>');
  expect(xml).not.toContain('/travaux');
  expect(xml).not.toContain('/work-in-progress');
});

// CSP stricte : même politique que le déploiement, recalculée sur les pages générées (test/csp.e2e.ts).

/** Empreinte CSP (`'sha256-…'`) du contenu exact d'un élément en ligne. */
function cspHash(content: string): string {
  return `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`;
}

function htmlFiles(directory: string): string[] {
  return readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) return htmlFiles(path);
      return name.endsWith('.html') ? [path] : [];
    });
}

/** Politique du déploiement, avec les empreintes des scripts exécutables et styles en ligne. */
function strictPolicy(): string {
  const scripts = new Set<string>();
  const styles = new Set<string>();
  for (const file of htmlFiles(PUBLIC_DIR)) {
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const attributes = match[1] ?? '';
      if (/\bsrc\s*=/i.test(attributes)) continue;
      if (/\btype\s*=\s*["']?application\/(ld\+)?json/i.test(attributes)) continue;
      scripts.add(cspHash(match[2] ?? ''));
    }
    for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      styles.add(cspHash(match[1] ?? ''));
    }
  }
  return [
    "default-src 'self'",
    `script-src 'self' ${[...scripts].sort().join(' ')}`.trim(),
    `style-src 'self' ${[...styles].sort().join(' ')}`.trim(),
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

test.describe('page « travaux en cours » sous la CSP stricte', () => {
  for (const wip of PAGES) {
    test(`${wip.path} : aucune violation ni erreur, puis l'autre langue`, async ({ page }) => {
      const policy = strictPolicy();
      // Témoin : la politique porte des empreintes, sans `'unsafe-inline'` ni `'unsafe-eval'`.
      expect(policy).toMatch(/script-src 'self' 'sha256-/);
      expect(policy).not.toContain('unsafe');

      await page.route('**/*', async (route) => {
        const request = route.request();
        if (request.resourceType() !== 'document') return route.continue();
        const pathname = new URL(request.url()).pathname;
        const document = PAGES.find((candidate) => candidate.path === pathname);
        if (document === undefined) return route.continue();
        return route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          headers: { 'content-security-policy': policy },
          body: readFileSync(join(PUBLIC_DIR, document.file)),
        });
      });
      await page.addInitScript(() => {
        const seen: string[] = [];
        Object.defineProperty(window, '__cspViolations', { value: seen });
        document.addEventListener('securitypolicyviolation', (event) => {
          seen.push(`${event.violatedDirective} bloque ${event.blockedURI || 'en ligne'}`);
        });
      });
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(String(error)));
      const violations = () =>
        page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);

      await page.goto(wip.path, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(wip.title);
      await expect(page.locator('html')).toHaveAttribute('data-theme', /^(clair|sombre)$/);
      expect(await violations()).toEqual([]);

      await page
        .getByRole('banner')
        .getByRole('link', { name: wip.languageLink, exact: true })
        .click();
      await expect(page).toHaveURL(wip.other);
      await page.waitForLoadState('networkidle');
      expect(await violations()).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});
