// Test par mutation du front (Stryker Mutator), docs/05 D3 : seulement la logique pure
// (`app/domain/`) et la couche de données (`app/data/`), couvertes par le projet Vitest `unit`.
// Même règle que le back (docs/02, CLAUDE.md) : aucun mutant survivant non justifié, seuil de
// rupture à 100 dès le départ (aucun code existant à mesurer avant F2 et F4) et jamais abaissé ;
// un vrai équivalent se déclare dans `stryker.equivalents.json` (identifiant WEB-EQ-NN, fichier créé
// sous autorisation au premier besoin) et s'ignore par une directive Stryker qui cite cet
// identifiant (autorisation, Justification-test).
//
// Configuration protégée (oracle « config » des garde-fous, Justification-test exigée).
// Documentation : https://stryker-mutator.io/docs/stryker-js/configuration/
//                 https://stryker-mutator.io/docs/stryker-js/vitest-runner/

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  mutate: [
    'app/domain/**/*.ts',
    'app/data/**/*.ts',
    '!app/**/*.spec.ts',
    '!app/**/*.fixtures.ts',
    '!app/**/fixtures/**',
  ],

  // Hors de la sandbox : sorties de Nuxt et de Playwright (dont le lien `dist` de `nuxt generate`,
  // que Stryker ne sait pas copier) et handoff de design (captures, sans code). `.nuxt` (types et
  // tsconfig générés par `nuxt prepare`), que Stryker 10 écarte toujours, est réintégré (`!`) : Vite
  // lit les références de tsconfig.json qui y pointent.
  ignorePatterns: [
    '!.nuxt',
    'dist',
    '.output',
    'coverage',
    'test-results',
    'playwright-report',
    'design',
  ],

  // Greffons chargés par chemin résolu depuis CE paquet (pnpm isole les node_modules : le motif par
  // défaut `@stryker-mutator/*` ne les voit pas depuis @stryker-mutator/core).
  plugins: [import.meta.resolve('@stryker-mutator/vitest-runner')],

  // Lanceur Vitest : configuration du paquet, projet `nuxt` écarté sous Stryker (vitest.config.ts).
  testRunner: 'vitest',
  // `related: false` : la passe initiale lance tous les tests du projet `unit` au lieu des seuls
  // tests qui importent un fichier muté (sans fichier muté, Stryker s'arrêterait sur « No tests
  // were executed ») ; chaque mutant ne rejoue ensuite que les tests qui l'exécutent (perTest).
  vitest: { configFile: 'vitest.config.ts', related: false },
  coverageAnalysis: 'perTest',

  // Score total non arrondi : (tués + timeouts) / (tués + timeouts + survivants + sans couverture).
  thresholds: { high: 100, low: 100, break: 100 },

  // Pas de vérificateur TypeScript pour l'instant : celui de Stryker compile avec `tsc`, qui ne lit
  // pas les .vue, et le projet `app` de Nuxt inclut les tests de composants (« Cannot find module
  // './app.vue' », compte rendu du lot F0). Sans lui, un mutant qui ne compile pas est jugé par les
  // tests (tué ou survivant), jamais retiré du score : la mesure est au moins aussi stricte. Il
  // reviendra avec un `tsconfig.stryker.json` limité à `app/domain` et `app/data` (fichier protégé,
  // autorisation demandée dans le compte rendu du lot F0).

  reporters: ['html', 'json', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  clearTextReporter: { allowEmojis: false, logTests: false, reportMutants: false },

  tempDirName: '../../.stryker-tmp-web',
};

export default config;
