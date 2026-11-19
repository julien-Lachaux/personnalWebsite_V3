// Test par mutation des contrats (Stryker Mutator), phase 1 : MESURE DE RÉFÉRENCE (lot 11).
// Aucun seuil n'est imposé (`thresholds.break` absent) : `pnpm test:mutation` mesure et rapporte.
// La règle « aucun mutant survivant non justifié » arrive en phase 2 (docs/02, CLAUDE.md).
//
// Configuration protégée (oracle « config » des garde-fous, Justification-test exigée).
// Documentation : https://stryker-mutator.io/docs/stryker-js/configuration/
//                 https://stryker-mutator.io/docs/stryker-js/vitest-runner/

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  // Schémas Zod et document OpenAPI : tout `src` sauf les tests et leurs jeux de données
  // (`*.fixtures.ts`). Aucun fichier de types purs ici : chaque module exporte des schémas Zod.
  mutate: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/*.fixtures.ts'],

  // Greffons chargés par chemin résolu depuis CE paquet : avec pnpm (node_modules isolés), le
  // motif par défaut `@stryker-mutator/*` ne cherche qu'à côté de @stryker-mutator/core, dans le
  // magasin pnpm, où le lanceur et le vérificateur ne sont pas visibles.
  plugins: [
    import.meta.resolve('@stryker-mutator/vitest-runner'),
    import.meta.resolve('@stryker-mutator/typescript-checker'),
  ],

  // Lanceur Vitest : il reprend la configuration Vitest du paquet et force lui-même un seul fil
  // par processus, sans couverture v8 (la mesure de `pnpm test:coverage` n'est pas touchée).
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },

  // Ne tester un mutant qu'avec les tests qui l'exécutent (le lanceur Vitest l'impose de toute façon).
  coverageAnalysis: 'perTest',

  // Vérificateur TypeScript : un mutant qui ne compile pas est classé « CompileError » sans lancer
  // de test, au lieu d'être compté tué ou survivant.
  // tsconfig.stryker.json = tsconfig.json, sans réécriture de chemins par Stryker (voir ce fichier).
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.stryker.json',

  // Rapports dans reports/mutation/ (gitignoré) : HTML à ouvrir, JSON pour l'analyse, texte en console.
  reporters: ['html', 'json', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  clearTextReporter: { allowEmojis: false, logTests: false, reportMutants: false },

  // Sandbox de travail (copie du paquet), gitignorée, supprimée après un passage réussi. Placée à
  // la racine du dépôt, à la même profondeur que le paquet (même règle que l'API).
  tempDirName: '../../.stryker-tmp-contracts',
};

export default config;
