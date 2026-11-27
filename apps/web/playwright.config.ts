// Parcours navigateur du front (docs/05, D4 ; F0-04) : Playwright + axe contre le site statique
// produit par `nuxt generate` (`.output/public`), servi sur l'hôte par sirv.
//
// Navigateurs en Docker (rien d'installé sur l'hôte) : service `playwright` de docker-compose.yml
// (`pnpm e2e:browsers:up`), image officielle de la même version que @playwright/test. Le lanceur
// tourne sur l'hôte et s'y connecte par WebSocket ; `exposeNetwork: '<loopback>'` fait passer les
// requêtes du navigateur vers localhost par l'hôte, où sirv sert le site.
//
// Un projet par taille d'écran des maquettes (handoff v6, SPEC § 3) ; schémas de couleur et langues
// dans les tests. Les parcours (`test/**/*.e2e.ts`) ne comptent pas dans la couverture (D3).
//
// Configuration protégée (oracle « config » des garde-fous, Justification-test exigée).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig, type Project } from '@playwright/test';

// Le `.env` racine (celui de docker compose) fixe les ports des worktrees en parallèle ; les
// variables déjà présentes dans l'environnement gardent la priorité.
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}
const browserPort = process.env['PLAYWRIGHT_PORT'] ?? '3100';
const sitePort = process.env['WEB_E2E_PORT'] ?? '4173';
const ci = process.env['CI'] !== undefined;

// Borne du nombre de processus (lot 43, décision du 25 nov. 2026, même règle que Vitest, L19-03) :
// TEST_MAX_WORKERS, entier positif ou pourcentage des cœurs logiques (`2`, `50%`), lue dans
// l'environnement puis dans le `.env` racine chargé ci-dessus (l'environnement l'emporte ; une valeur
// vide compte comme absente). Sans valeur : `workers` par défaut de Playwright (la moitié des cœurs),
// en CI compris. `--workers` en ligne de commande l'emporte. Une valeur invalide arrête Playwright.
const workersSetting = process.env['TEST_MAX_WORKERS'] ?? '';
if (workersSetting !== '' && !/^([1-9]\d*|([1-9]\d?|100)%)$/.test(workersSetting)) {
  throw new Error(
    `TEST_MAX_WORKERS invalide (« ${workersSetting} ») : un entier positif ou un pourcentage de 1 à 100 %, ex. 4 ou 50%.`,
  );
}
const workers =
  workersSetting === ''
    ? {}
    : {
        workers: workersSetting.endsWith('%')
          ? workersSetting
          : Number.parseInt(workersSetting, 10),
      };

/** Tailles d'écran des maquettes v6 (nom de capture de référence : `<écran>-<largeur>`). */
export const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablette-834', width: 834, height: 1112 },
  { name: 'portable-1024', width: 1024, height: 768 },
  { name: 'desktop-1280', width: 1280, height: 844 },
  { name: 'grand-1440', width: 1440, height: 900 },
  { name: 'fullhd-1920', width: 1920, height: 1080 },
  { name: 'ultra-3440', width: 3440, height: 1440 },
] as const;

const projects: Project[] = viewports.map(({ name, width, height }) => ({
  name,
  use: { browserName: 'chromium', viewport: { width, height } },
}));

export default defineConfig({
  testDir: 'test',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  ...workers,
  // Un `.only` oublié fait échouer la passe au lieu de taire les autres tests.
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${sitePort}`,
    connectOptions: {
      wsEndpoint: `ws://127.0.0.1:${browserPort}/`,
      exposeNetwork: '<loopback>',
      timeout: 30_000,
    },
    trace: 'retain-on-failure',
  },
  projects,
  webServer: {
    command: `sirv .output/public --port ${sitePort} --host 127.0.0.1 --quiet`,
    url: `http://127.0.0.1:${sitePort}/`,
    // Un serveur déjà présent sur ce port (autre worktree) fait échouer au lieu d'être testé.
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
