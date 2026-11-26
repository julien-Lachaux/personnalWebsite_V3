import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { expectAxeClean, waitForHydration } from './support/e2e.js';

// Page « travaux en cours » (lot 31), à chaque taille d'écran des maquettes, en clair et en sombre,
// en français et en anglais :
// - message, contact (mailto de la configuration, adresse non affichée), profil LinkedIn lu dans le CV
//   au build (lien externe, nouvel onglet), en-tête des pages annexes (langue, thème), axe ;
// - hors index : `noindex`, ni canonique ni hreflang, absente de `sitemap.xml` ;
// - servie telle quelle quel que soit le statut HTTP (le proxy du lot 32 peut la servir en 503) ;
// - sous la CSP stricte du déploiement (empreintes recalculées sur les pages générées, comme
//   test/csp.e2e.ts), sans violation ni erreur de console.

const PUBLIC_DIR = resolve(import.meta.dirname, '../.output/public');
/** Lien social `linkedin` du CV de test, lu par `generate:fixtures` (fr et en). */
const LINKEDIN_URL = 'https://www.linkedin.com/in/example';

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
    linkedin: "Profil LinkedIn (s'ouvre dans un nouvel onglet)",
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
    linkedin: 'LinkedIn profile (opens in a new tab)',
  },
] as const;

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
      test(`${wip.path} (${wip.locale}) : message, contact, LinkedIn, hors index, axe`, async ({
        page,
      }) => {
        const response = await page.goto(wip.path);
        expect(response?.status()).toBe(200);
        await waitForHydration(page);

        await expect(page.locator('html')).toHaveAttribute('lang', wip.locale);
        await expect(page.locator('html')).toHaveAttribute('data-theme', /^(clair|sombre)$/);
        await expect(page.locator('a, button').first()).toHaveClass(/skip-link/);
        await expect(page.getByRole('banner')).toHaveCount(1);
        await expect(page.locator('main#contenu')).toHaveCount(1);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(wip.title);

        // Deux liens seulement dans le contenu : contact puis LinkedIn (pas de retour à l'accueil).
        const main = page.getByRole('main');
        await expect(main.getByRole('link')).toHaveCount(2);
        await expect(main.getByRole('link', { name: wip.contact })).toHaveAttribute(
          'href',
          `mailto:contact@example.org?subject=${encodeURIComponent(wip.subject)}`,
        );
        await expect(main).not.toContainText('contact@example.org');
        const linkedin = main.getByRole('link', { name: wip.linkedin, exact: true });
        await expect(linkedin).toHaveAttribute('href', LINKEDIN_URL);
        await expect(linkedin).toHaveAttribute('target', '_blank');
        await expect(linkedin).toHaveAttribute('rel', 'noopener noreferrer');

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

        await expectAxeClean(page);

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
        await waitForHydration(page);

        await expect(page).toHaveURL(wip.path);
        await expect(page.locator('html')).toHaveAttribute('lang', wip.locale);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(wip.title);
        await expect(page.getByRole('main').getByRole('link')).toHaveCount(2);
        await expectAxeClean(page);
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

// Charge utile (décision de Julien) : de tout le CV, la page ne publie que l'URL de LinkedIn. Fichier
// `_payload.json` (format devalue de Nuxt : tableau de valeurs reliées par leur indice) et données en
// ligne du HTML (`__NUXT_DATA__`) : aucun autre champ du CV.
const CV_FIELDS = ['profile', 'experiences', 'recommendations', 'skillGroups', 'socialLinks'];

for (const wip of PAGES) {
  test(`${wip.path} : la charge utile ne contient que l'URL de LinkedIn`, () => {
    const directory = join(PUBLIC_DIR, wip.file, '..');
    const source = readFileSync(join(directory, '_payload.json'), 'utf8');
    const payload = JSON.parse(source) as unknown[];
    const at = (index: unknown): unknown => payload[index as number];

    // `data` → ["ShallowReactive", i] → { clé : j } → valeur.
    const root = payload[0] as { data: number };
    const [kind, dataIndex] = at(root.data) as [string, number];
    expect(kind).toBe('ShallowReactive');
    const data = at(dataIndex) as Record<string, number>;
    expect(Object.keys(data)).toEqual([`cv-${wip.locale}-linkedin`]);
    expect(at(data[`cv-${wip.locale}-linkedin`])).toBe(LINKEDIN_URL);

    const inline = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(
      readFileSync(join(PUBLIC_DIR, wip.file), 'utf8'),
    )?.[1];
    expect(inline).toBeDefined();
    for (const text of [source, inline ?? '']) {
      for (const field of CV_FIELDS) expect(text).not.toContain(`"${field}"`);
      expect(text).not.toContain('"cv-fr"');
      expect(text).not.toContain('"cv-en"');
    }
  });
}

test('témoin : la charge utile de l’accueil contient le CV entier sous `cv-fr`', () => {
  const source = readFileSync(join(PUBLIC_DIR, '_payload.json'), 'utf8');

  expect(source).toContain('"cv-fr"');
  for (const field of CV_FIELDS) expect(source).toContain(`"${field}"`);
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
