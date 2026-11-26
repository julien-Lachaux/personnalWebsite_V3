import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { buildPolicy, collectHashes } from '../../../scripts/deploy/csp-hashes.mjs';
import { analyzeWcag22AA, gotoMounted } from './support/e2e.js';

// CSP stricte (lot F9a, BF-14) : le site généré s'affiche sous la politique que le proxy de
// production pose (aucun domaine tiers, scripts et styles en ligne autorisés par leur seule empreinte,
// ni `'unsafe-inline'` ni `'unsafe-eval'`), sans aucune violation ni erreur de console, au chargement
// comme après une navigation dans l'application.
//
// La politique est celle du déploiement : elle vient de `scripts/deploy/csp-hashes.mjs`, importé
// ici (RC-8, D40), sans copie ; les empreintes sont relevées sur les pages générées. Le document est servi par
// `page.route` depuis `.output/public` avec l'en-tête, selon les règles du proxy (`{path}`, puis
// `{path}/index.html`, sinon `404.html` en 404) ; les autres ressources viennent du serveur statique
// des parcours. Un témoin vérifie que la politique est bien appliquée et les violations relevées.

const publicDir = resolve(import.meta.dirname, '../.output/public');

/** Politique servie par le déploiement, empreintes relevées sur les pages générées. */
function deployedPolicy(): string {
  return buildPolicy(collectHashes(publicDir));
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
      const observed = await watch(page, deployedPolicy());

      const response = await page.goto(path, { waitUntil: 'networkidle' });

      expect(response?.status()).toBe(status);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.locator('main#contenu')).toHaveCount(1);
      // Le script de thème (D5) a tourné sous la CSP : il pose toujours `data-theme`.
      await expect(page.locator('html')).toHaveAttribute('data-theme', /^(clair|sombre)$/);
      const results = await analyzeWcag22AA(page);
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
      const observed = await watch(page, deployedPolicy());
      await gotoMounted(page, from, { waitUntil: 'networkidle' });

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
