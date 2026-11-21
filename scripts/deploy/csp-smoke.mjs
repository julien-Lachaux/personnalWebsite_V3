#!/usr/bin/env node
// Parcours de fumée de la CSP du front (BF-15) : charge les pages dans un vrai navigateur (service docker
// `playwright`, version de @playwright/test d'apps/web) et échoue à la première violation de la
// politique de sécurité du contenu (événement `securitypolicyviolation`, message de console CSP).
// Il prouve aussi que le script de thème (D5) a tourné sous la CSP : `<html data-theme>` est posé.
//
// Usage : csp-smoke.mjs <URL de la pile, ex. https://localhost:8443> <ws://hote:port du serveur de navigateurs>
// Le navigateur tourne dans Docker : `exposeNetwork: '<loopback>'` fait passer ses requêtes vers localhost
// par l'hôte, où Caddy publie la pile (certificat interne : erreurs TLS ignorées).
// Codes de sortie : 0 aucune violation ; 1 violation ou page incorrecte ; 2 usage.
import { createRequire } from 'node:module';

// La page 404 du front est une coquille rendue côté client (200.html copié en 404.html) : le statut 404
// vient de Caddy, et le navigateur l'affiche sans `<main id="contenu">` garanti.
const PAGES = [
  { path: '/', status: 200, main: true },
  { path: '/en', status: 200, main: true },
  { path: '/accessibilite', status: 200, main: true },
  { path: '/en/accessibilite', status: 200, main: true },
  { path: '/route-inconnue', status: 404, main: false },
];

/** Violations et erreurs relevées sur une page. */
export function summarize(violations, consoleErrors, theme, hasMain) {
  const problems = [];
  for (const violation of violations) {
    problems.push(`violation CSP : ${violation}`);
  }
  for (const message of consoleErrors) {
    problems.push(`erreur de console : ${message}`);
  }
  if (!theme) {
    problems.push('<html data-theme> absent : le script de thème n’a pas tourné');
  }
  if (!hasMain) {
    problems.push('<main id="contenu"> absent : la page ne s’est pas affichée');
  }
  return problems;
}

async function main(argv) {
  const [base, endpoint, ...extra] = argv;
  if (base === undefined || endpoint === undefined || extra.length > 0) {
    process.stderr.write('Usage : csp-smoke.mjs <URL de la pile> <ws://serveur de navigateurs>\n');
    return 2;
  }
  // Playwright est une dépendance d'apps/web : résolue depuis son paquet, sans l'ajouter à la racine.
  const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
  const { chromium } = require('@playwright/test');
  const browser = await chromium.connect(endpoint, {
    exposeNetwork: '<loopback>',
    timeout: 30_000,
  });
  let failed = false;
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    for (const { path, status, main: expectMain } of PAGES) {
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });
      page.on('pageerror', (error) => consoleErrors.push(String(error)));
      await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          window.__cspViolations.push(
            `${event.violatedDirective} bloque ${event.blockedURI || 'en ligne'} (${event.sourceFile || 'page'})`,
          );
        });
      });
      const response = await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
      const violations = await page.evaluate(() => window.__cspViolations);
      const theme = await page.evaluate(() => document.documentElement.hasAttribute('data-theme'));
      const hasMain = (await page.locator('main#contenu').count()) === 1;
      const problems = summarize(violations, consoleErrors, theme, hasMain || !expectMain);
      if (response === null || response.status() !== status) {
        problems.push(
          `statut ${response === null ? 'absent' : response.status()} au lieu de ${status}`,
        );
      }
      process.stdout.write(`[csp-smoke] ${path} : ${problems.length === 0 ? 'ok' : 'ÉCHEC'}\n`);
      for (const problem of problems) {
        process.stderr.write(`[csp-smoke]   ${problem}\n`);
        failed = true;
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return failed ? 1 : 0;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`[csp-smoke] ERREUR : ${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
