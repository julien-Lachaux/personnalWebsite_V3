// Configuration Vitest du front (docs/05, D3) : deux projets, une seule mesure de couverture.
// - `unit` : logique pure (`app/domain/`), couche de données (`app/data/`) et test d'architecture,
//            en environnement Node, sans Nuxt ni DOM.
// - `nuxt` : composants, composables, pages et `app.vue` dans l'environnement Nuxt de
//            @nuxt/test-utils (happy-dom, auto-imports, i18n), montés par `mountSuspended`.
// Les tests sont à côté du code (`*.spec.ts`) ; le projet se déduit du dossier, jamais d'un
// commentaire `@vitest-environment` (il ne charge pas les greffons Nuxt).
// `pnpm test` lance les deux projets ; `pnpm test:coverage` les fusionne : 100 % exigé sur les quatre
// métriques pour tout `app/` (TypeScript et Vue), aucun fichier de production exclu, aucun
// commentaire d'ignore. Les parcours Playwright (`test/**/*.e2e.ts`) ne comptent pas (D3).
//
// Configuration protégée (oracle « config » des garde-fous, Justification-test exigée).
import { defineVitestProject } from '@nuxt/test-utils/config';
import { defineConfig } from 'vitest/config';

const unitInclude = [
  'app/domain/**/*.spec.ts',
  'app/data/**/*.spec.ts',
  'app/architecture.spec.ts',
];

// Test par mutation (Stryker, `pnpm test:mutation`) : il ne mute que `app/domain/` et `app/data/`,
// couverts par le projet `unit`. Le lanceur Vitest de Stryker ne transmet pas `--project` : le
// projet `nuxt` est écarté quand Stryker exécute les tests (STRYKER_MUTATOR_WORKER, posé par
// Stryker dans ses processus), comme pour le projet e2e de l'API. Sans effet hors Stryker.
const mutationRun = process.env['STRYKER_MUTATOR_WORKER'] !== undefined;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: unitInclude,
          environment: 'node',
        },
      },
      ...(mutationRun
        ? []
        : [
            await defineVitestProject({
              test: {
                name: 'nuxt',
                include: ['app/**/*.spec.ts'],
                exclude: unitInclude,
                environment: 'nuxt',
              },
            }),
          ]),
    ],
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,vue}'],
      exclude: ['app/**/*.spec.ts'],
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
