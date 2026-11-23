import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// CSP stricte (lot F9a, BF-14) : le site généré s'affiche sous la politique que le proxy de
// production pose (aucun domaine tiers, scripts et styles en ligne autorisés par leur seule empreinte,
// ni `'unsafe-inline'` ni `'unsafe-eval'`), sans aucune violation ni erreur de console, au chargement
// comme après une navigation dans l'application.
//
// La politique est recalculée ici à partir des pages générées, comme le fait le déploiement
// (`scripts/deploy/csp-hashes.mjs`, côté back) ; le front n'en dépend pas. Le document est servi par
// `page.route` depuis `.output/public` avec l'en-tête, selon les règles du proxy (`{path}`, puis
// `{path}/index.html`, sinon `404.html` en 404) ; les autres ressources viennent du serveur statique
// des parcours. Un témoin vérifie que la politique est bien appliquée et les violations relevées.

const publicDir = resolve(import.meta.dirname, '../.output/public');

/** Règles axe des niveaux A et AA de WCAG 2.0, 2.1 et 2.2. */
const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Scripts de données (non exécutés) : la CSP ne les contrôle pas.
const DATA_SCRIPT_TYPES = new Set(['application/json', 'application/ld+json']);

interface InlineHashes {
  readonly scripts: readonly string[];
  readonly styles: readonly string[];
}

/** Empreinte CSP (`'sha256-…'`) du contenu exact d'un élément en ligne. */
function cspHash(content: string): string {
  return `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`;
}

/** Empreintes des scripts exécutables et des styles en ligne d'une page HTML. */
function inlineHashes(html: string): InlineHashes {
  const scripts: string[] = [];
  const styles: string[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1] ?? '';
    if (/\bsrc\s*=/i.test(attributes)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)?.[1]?.toLowerCase();
    if (type !== undefined && DATA_SCRIPT_TYPES.has(type)) continue;
    scripts.push(cspHash(match[2] ?? ''));
  }
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    styles.push(cspHash(match[1] ?? ''));
  }
  return { scripts, styles };
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

/** Empreintes (sans doublon, triées) de toutes les pages générées. */
function collectHashes(): InlineHashes {
  const pages = htmlFiles(publicDir);
  if (pages.length === 0) throw new Error(`aucune page HTML dans ${publicDir}`);
  const scripts = new Set<string>();
  const styles = new Set<string>();
  for (const page of pages) {
    const found = inlineHashes(readFileSync(page, 'utf8'));
    found.scripts.forEach((hash) => scripts.add(hash));
    found.styles.forEach((hash) => styles.add(hash));
  }
  return { scripts: [...scripts].sort(), styles: [...styles].sort() };
}

/** Politique complète, directive par directive celle du déploiement. */
function buildPolicy({ scripts, styles }: InlineHashes): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${scripts.join(' ')}`.trim(),
    `style-src 'self' ${styles.join(' ')}`.trim(),
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/** Fichier servi pour un chemin, comme le proxy : `{path}`, `{path}/index.html`, sinon la 404. */
function documentFor(pathname: string): { status: number; file: string } {
  const path = join(publicDir, decodeURIComponent(pathname));
  if (path.startsWith(publicDir)) {
    if (existsSync(path) && statSync(path).isFile()) return { status: 200, file: path };
    const index = join(path, 'index.html');
    if (existsSync(index)) return { status: 200, file: index };
  }
  const notFound = pathname === '/en' || pathname.startsWith('/en/') ? 'en/404.html' : '404.html';
  return { status: 404, file: join(publicDir, notFound) };
}

interface Watch {
  readonly violations: () => Promise<string[]>;
  readonly errors: string[];
}

/**
 * Sert chaque document avec la politique donnée et relève, dès le premier octet, les violations de
 * la CSP (`securitypolicyviolation`), les erreurs de console et les exceptions de la page.
 */
async function watch(page: Page, policy: string): Promise<Watch> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'document') return route.continue();
    const { status, file } = documentFor(new URL(request.url()).pathname);
    return route.fulfill({
      status,
      contentType: 'text/html; charset=utf-8',
      headers: { 'content-security-policy': policy },
      body: readFileSync(file),
    });
  });
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.defineProperty(window, '__cspViolations', { value: seen });
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(
        `${event.violatedDirective} bloque ${event.blockedURI || 'en ligne'} (${event.sourceFile || 'page'}:${event.lineNumber}:${event.columnNumber})`,
      );
    });
  });
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // Le navigateur journalise le statut d'un document en erreur : c'est le 404 attendu d'une
    // adresse inconnue (vérifié par le statut de la réponse), pas une erreur de la page.
    const location = message.location().url;
    const documentStatus = /^Failed to load resource: the server responded with a status of 404\b/;
    if (documentStatus.test(message.text()) && location === page.url()) return;
    errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  return {
    violations: () =>
      page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations),
    errors,
  };
}

const pages = [
  { path: '/', status: 200, lang: 'fr', heading: 'Développeur full-stack' },
  { path: '/en', status: 200, lang: 'en', heading: 'Full-stack developer' },
  { path: '/accessibilite', status: 200, lang: 'fr', heading: 'Déclaration d’accessibilité' },
  { path: '/en/accessibility', status: 200, lang: 'en', heading: 'Accessibility statement' },
  { path: '/route-inconnue', status: 404, lang: 'fr', heading: 'Page introuvable' },
  { path: '/en/route-inconnue', status: 404, lang: 'en', heading: 'Page not found' },
] as const;

test.describe('CSP stricte du déploiement', () => {
  for (const { path, status, lang, heading } of pages) {
    test(`${path} : aucune violation, script de thème exécuté, page affichée`, async ({ page }) => {
      const observed = await watch(page, buildPolicy(collectHashes()));

      const response = await page.goto(path, { waitUntil: 'networkidle' });

      expect(response?.status()).toBe(status);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.locator('main#contenu')).toHaveCount(1);
      // Le script de thème (D5) a tourné sous la CSP : il pose toujours `data-theme`.
      await expect(page.locator('html')).toHaveAttribute('data-theme', /^(clair|sombre)$/);
      const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
      expect(results.violations).toEqual([]);
      expect(await observed.violations()).toEqual([]);
      expect(observed.errors).toEqual([]);
    });
  }

  for (const { from, to, lang } of [
    { from: '/', to: '/en', lang: 'en' },
    { from: '/en', to: '/', lang: 'fr' },
  ] as const) {
    test(`navigation ${from} → ${to} dans l'application : aucune violation`, async ({ page }) => {
      const observed = await watch(page, buildPolicy(collectHashes()));
      await page.goto(from, { waitUntil: 'networkidle' });
      await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);

      await page.locator(`.language-switch a[hreflang="${lang}"]`).click();

      await expect(page).toHaveURL(to);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await page.waitForLoadState('networkidle');
      expect(await observed.violations()).toEqual([]);
      expect(observed.errors).toEqual([]);
    });
  }

  // Témoin de l'oracle : sans les empreintes, la même page sous la même politique viole la CSP (le
  // script de thème et les styles en ligne sont bloqués) ; sinon une liste vide ne prouverait rien.
  test('témoin : une politique sans les empreintes est appliquée et ses violations relevées', async ({
    page,
  }) => {
    const observed = await watch(page, buildPolicy({ scripts: [], styles: [] }));

    await page.goto('/', { waitUntil: 'networkidle' });

    const violations = await observed.violations();
    expect(
      violations.some((violation) => violation.startsWith('script-src-elem bloque inline ')),
    ).toBe(true);
    expect(
      violations.some((violation) => violation.startsWith('style-src-elem bloque inline ')),
    ).toBe(true);
  });
});
