// Configuration Vitest de l'API : deux projets, une seule mesure de couverture.
// - `unit` : tests unitaires `src/**/*.spec.ts`, aucun accès réseau ni base de données.
// - `e2e`  : application Nest complète (app.inject de Fastify) contre le PostgreSQL de test
//            de docker-compose (`pnpm db:test:up`).
// `vitest run --project unit` (pnpm test), `--project e2e` (pnpm test:e2e) ; sans filtre, les deux
// projets tournent et la couverture (`--coverage`, pnpm test:coverage) est fusionnée : 100 % exigé
// sur les quatre métriques, aucun fichier de production exclu, aucun commentaire d'ignore.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Le `.env` racine (celui de docker compose) fixe POSTGRES_TEST_PORT pour les worktrees en
// parallèle ; les variables déjà présentes dans l'environnement gardent la priorité.
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}
const testPort = process.env['POSTGRES_TEST_PORT'] ?? '5433';

// Test par mutation (Stryker, `pnpm test:mutation`, phase 1 : unitaires seulement). Le lanceur
// Vitest de Stryker ne transmet pas `--project`, et son option `testFiles` fait activer les
// mutants statiques après le chargement des modules (ils survivraient tous à tort) : le projet e2e
// est donc écarté ici quand Stryker exécute les tests (STRYKER_MUTATOR_WORKER, posé par Stryker
// dans ses processus). Sans effet hors Stryker : `pnpm test:coverage` garde les deux projets.
// Phase 3 (e2e) : retirer cette condition.
const mutationRun = process.env['STRYKER_MUTATOR_WORKER'] !== undefined;

export default defineConfig({
  plugins: [
    // SWC émet les métadonnées de décorateurs (design:paramtypes) dont l'injection Nest dépend ;
    // esbuild (transformateur par défaut de Vitest) ne le fait pas.
    swc.vite({ module: { type: 'es6' } }),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          // Base neuve garantie avant le premier fichier (migrations + seeds).
          globalSetup: ['test/support/global-setup.ts'],
          environment: 'node',
          // Un seul processus : l'application et sa connexion sont partagées entre les fichiers.
          fileParallelism: false,
          testTimeout: 15_000,
          hookTimeout: 30_000,
          env: {
            NODE_ENV: 'test',
            PORT: process.env['PORT'] ?? '3000',
            CORS_ORIGIN: process.env['CORS_ORIGIN'] ?? 'http://localhost:3001',
            DATABASE_URL:
              process.env['DATABASE_URL'] ??
              `postgres://siteperso:siteperso@localhost:${testPort}/siteperso_test`,
          },
        },
      },
    ].filter((project) => !mutationRun || project.test.name === 'unit'),
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts'],
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
