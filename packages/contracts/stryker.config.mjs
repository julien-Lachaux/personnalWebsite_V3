// Test par mutation des contrats (Stryker Mutator), phase 2 (lot 12) : règle « aucun mutant
// survivant non justifié » (docs/02, CLAUDE.md), seuil de rupture relevé au score obtenu et jamais
// abaissé (`thresholds`, plus bas). Mesure de référence : lot 11. Aucune exclusion par motif ici
// (les deux motifs du cadrage visent l'API) ; équivalents déclarés : stryker.equivalents.json.
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

  // Seuils (phase 2, lot 12). Stryker compare `break` au score TOTAL, non arrondi :
  // (tués + timeouts) / (tués + timeouts + survivants + sans couverture), erreurs de compilation et
  // mutants ignorés exclus. Lot 12 : 418 tués sur 418, 100 % (aucun survivant, aucun sans
  // couverture) ; l'instantané du document OpenAPI protège ses libellés. Un seul mutant survivant
  // non déclaré fait donc échouer `pnpm test:mutation` : un vrai équivalent se déclare dans
  // stryker.equivalents.json et s'ignore par une directive Stryker qui cite son identifiant
  // (autorisation, Justification-test) ; le seuil ne s'abaisse JAMAIS.
  thresholds: { high: 100, low: 100, break: 100 },

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
