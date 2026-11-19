// Test par mutation de l'API (Stryker Mutator), phase 1 : MESURE DE RÉFÉRENCE (lot 11).
// Aucun seuil n'est imposé (`thresholds.break` absent) : `pnpm test:mutation` mesure et rapporte.
// La règle « aucun mutant survivant non justifié » arrive en phase 2 (docs/02, CLAUDE.md).
//
// Configuration protégée (oracle « config » des garde-fous, Justification-test exigée).
// Documentation : https://stryker-mutator.io/docs/stryker-js/configuration/
//                 https://stryker-mutator.io/docs/stryker-js/vitest-runner/

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  // Code de production seulement : ni tests unitaires (*.spec.ts), ni tests e2e (test/, hors
  // `src`). Les fichiers de types purs (entités du domaine : `interface` et `type` seulement) ne
  // sont pas listés à part : effacés à la compilation, ils ne produisent aucun mutant. Une règle
  // métier ajoutée plus tard dans `src/domain` sera donc mutée sans retoucher cette liste.
  mutate: ['src/**/*.ts', '!src/**/*.spec.ts'],

  // Greffons chargés par chemin résolu depuis CE paquet : avec pnpm (node_modules isolés), le
  // motif par défaut `@stryker-mutator/*` ne cherche qu'à côté de @stryker-mutator/core, dans le
  // magasin pnpm, où le lanceur et le vérificateur ne sont pas visibles.
  plugins: [
    import.meta.resolve('@stryker-mutator/vitest-runner'),
    import.meta.resolve('@stryker-mutator/typescript-checker'),
  ],

  // Lanceur Vitest : il reprend la configuration Vitest du paquet (plugin SWC d'unplugin-swc
  // compris, nécessaire aux métadonnées de décorateurs de Nest) et force lui-même un seul fil par
  // processus, sans couverture v8 (la mesure de `pnpm test:coverage` n'est pas touchée).
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },

  // Phase 1 : tests unitaires seulement (projet Vitest « unit »). Le lanceur ne transmet pas
  // `--project` : c'est vitest.config.ts qui écarte le projet « e2e » (et son globalSetup qui exige
  // PostgreSQL) dans les processus de Stryker (variable STRYKER_MUTATOR_WORKER).
  // L'option `testFiles` de Stryker n'est PAS utilisée : en 10.1.1, elle fait activer les mutants
  // statiques (code exécuté au chargement des modules) après ce chargement, si bien qu'ils
  // survivent tous à tort (vérifié sur src/cli/paths.ts, lot 11).
  // Phase 3, pour inclure les e2e : retirer la condition de vitest.config.ts, démarrer la base de
  // test (`pnpm db:test:up`), déclarer DATABASE_URL et POSTGRES_TEST_PORT dans `env` de la tâche
  // turbo `test:mutation`, et fixer `concurrency: 1` : les e2e partagent une seule base et ne
  // tournent pas en parallèle (`fileParallelism: false`).

  // Ne tester un mutant qu'avec les tests qui l'exécutent (le lanceur Vitest l'impose de toute façon).
  coverageAnalysis: 'perTest',

  // Vérificateur TypeScript : un mutant qui ne compile pas (tsconfig.json : src et tests) est
  // classé « CompileError » sans lancer de test, au lieu d'être compté tué ou survivant.
  // tsconfig.stryker.json = tsconfig.json, sans réécriture de chemins par Stryker (voir ce fichier).
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.stryker.json',

  // Rapports dans reports/mutation/ (gitignoré) : HTML à ouvrir, JSON pour l'analyse, texte en console.
  reporters: ['html', 'json', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  clearTextReporter: { allowEmojis: false, logTests: false, reportMutants: false },

  // Sandbox de travail (copie du paquet), gitignorée, supprimée après un passage réussi. Elle est
  // placée à la racine du dépôt : `<racine>/.stryker-tmp-api/sandbox-<id>/` est à la même
  // profondeur que `apps/api`, donc les chemins relatifs vers la racine (db/migrations, db/seeds,
  // `.env` racine) y désignent les mêmes fichiers qu'hors Stryker (src/cli/paths.ts en dépend).
  tempDirName: '../../.stryker-tmp-api',
};

export default config;
