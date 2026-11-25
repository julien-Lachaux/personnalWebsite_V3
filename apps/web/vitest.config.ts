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
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

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

// Borne du nombre de processus (lot F6, même règle que l'API, L19-03) : TEST_MAX_WORKERS, entier
// positif ou pourcentage des cœurs (`4`, `50%`), lue dans l'environnement puis dans le `.env` racine
// du worktree. Seule cette clé est lue dans ce fichier (`parseEnv`, sans charger le reste dans
// `process.env` : ses autres variables ne regardent pas les tests du front). Sans valeur : `maxWorkers`
// par défaut de Vitest, en CI compris ; posée sur chacun des deux projets, qui n'héritent pas des
// options de la racine (même valeur pour les deux : Vitest refuse deux bornes dans un même groupe,
// L14-15) ; ignorée sous Stryker ;
// `--maxWorkers=<n>` en ligne de commande l'emporte. Une valeur invalide arrête Vitest.
const rootEnv = resolve(import.meta.dirname, '../../.env');
const rootEnvWorkers = existsSync(rootEnv)
  ? parseEnv(readFileSync(rootEnv, 'utf8'))['TEST_MAX_WORKERS']
  : undefined;
const maxWorkersSetting = process.env['TEST_MAX_WORKERS'] ?? rootEnvWorkers ?? '';
if (maxWorkersSetting !== '' && !/^([1-9]\d*|([1-9]\d?|100)%)$/.test(maxWorkersSetting)) {
  throw new Error(
    `TEST_MAX_WORKERS invalide (« ${maxWorkersSetting} ») : un entier positif ou un pourcentage de 1 à 100 %, ex. 4 ou 50%.`,
  );
}
const maxWorkers =
  maxWorkersSetting === '' || mutationRun
    ? {}
    : {
        maxWorkers: maxWorkersSetting.endsWith('%')
          ? maxWorkersSetting
          : Number.parseInt(maxWorkersSetting, 10),
      };

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...maxWorkers,
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
                ...maxWorkers,
                name: 'nuxt',
                include: ['app/**/*.spec.ts'],
                exclude: unitInclude,
                environment: 'nuxt',
                // Configuration de l'application de test (lot F3a) : le CV vient des fixtures du
                // dépôt (jamais du réseau) et le bouton « Lancer l'entretien » a une adresse
                // placeholder, comme la génération des parcours Playwright. Un test qui exerce une
                // autre configuration la pose lui-même (`useRuntimeConfig()`).
                environmentOptions: {
                  nuxt: {
                    overrides: {
                      runtimeConfig: {
                        cvSource: 'fixtures',
                        public: { contactEmail: 'contact@example.org' },
                      },
                    },
                  },
                },
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
