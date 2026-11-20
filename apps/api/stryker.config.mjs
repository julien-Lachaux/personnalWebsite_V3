// Test par mutation de l'API (Stryker Mutator), phase 2 (lot 12) : règle « aucun mutant survivant
// non justifié sur le code atteignable par les unitaires » (docs/02, CLAUDE.md), seuil de rupture
// relevé au score obtenu et jamais abaissé (`thresholds`, plus bas). Mesure de référence : lot 11.
//
// Configuration protégée (oracle « config » des garde-fous, Justification-test exigée).
// Documentation : https://stryker-mutator.io/docs/stryker-js/configuration/
//                 https://stryker-mutator.io/docs/stryker-js/vitest-runner/
//                 https://stryker-mutator.io/docs/stryker-js/disable-mutants/

// ---------------------------------------------------------------------------------------------
// Exclusions par motif (phase 2, lot 12, cadrage du 2026-11-19) : DEUX motifs seulement, chacun
// un greffon « ignorer » de Stryker (option `ignorers`). Les greffons sont déclarés ici même :
// ce fichier exporte `strykerPlugins` et se charge lui-même comme greffon (`plugins`, plus bas).
// Un mutant écarté reste visible dans le rapport (statut Ignored, avec le motif) et sort du
// score. Tout autre mutant à écarter est un équivalent, déclaré nominativement dans
// stryker.equivalents.json ; aucun motif ne s'ajoute sans décision de Julien.
//
// Motif 1, « métadonnées déclaratives du schéma Drizzle » : les arguments des déclarations
//   `pgTable`, `pgEnum` et `customType` importées de drizzle-orm/pg-core (seuls les fichiers de
//   src/infrastructure/db/schema/ en appellent). Le SQL de db/migrations est la source de
//   vérité, et ces métadonnées (valeurs d'enum, `mode`, `.default()`, noms d'index et
//   d'unicité, `references`/`onDelete`, `primaryKey`, domaine `locale_code`) ne sont lues par
//   aucune requête des dépôts. Restent mutés, et comptés : les NOMS de tables (1er argument de
//   `pgTable`) et de colonnes (1er argument du constructeur de chaque colonne), que les requêtes
//   émettent et que la phase 3 confrontera à la base (test/db/schema-matches-db.e2e-spec.ts),
//   ainsi que les nœuds qui les contiennent (objet des colonnes vidé, par exemple). Le fichier
//   n'est pas reconnu à son nom : Babel ne le transmet pas aux greffons « ignorer » (vérifié en
//   10.1.1), d'où la reconnaissance par l'import. Effectif au lot 12 : 204 mutants écartés
//   (90 survivants, 114 erreurs de compilation, aucun mutant tué) ; restent 169 survivants, tous
//   des noms de tables (23) et de colonnes (146), réserve de la phase 3.
//
// Motif 2, « contexte des messages de journal » : le nom de contexte passé à `new Logger(…)`
//   (Nest l'affiche en préfixe des lignes de journal, aucun comportement n'en dépend).
//   Effectif au lot 12 : 1 mutant écarté (survivant, send-problem.ts). Le contexte des appels
//   statiques (`Logger.log(message, 'Bootstrap')` de main.ts) n'est pas écarté : il est tué.

const DRIZZLE_MODULE = 'drizzle-orm/pg-core';
const SCHEMA_BUILDERS = new Set(['pgTable', 'pgEnum', 'customType']);
const SCHEMA_REASON =
  'Motif 1 (stryker.config.mjs) : métadonnée déclarative du schéma Drizzle, le SQL de db/migrations fait foi';
const LOG_CONTEXT_REASON =
  'Motif 2 (stryker.config.mjs) : contexte des messages de journal (new Logger)';

/** Noms locaux (nom local -> nom importé) des déclarations de schéma importées de pg-core. */
function schemaBuilders(program) {
  const builders = new Map();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== DRIZZLE_MODULE) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ImportSpecifier' || specifier.importKind === 'type') continue;
      const imported = specifier.imported.name ?? specifier.imported.value;
      if (SCHEMA_BUILDERS.has(imported)) builders.set(specifier.local.name, imported);
    }
  }
  return builders;
}

/** Plages [début, fin] des littéraux de nom SQL (tables, colonnes) d'un programme Drizzle. */
function sqlNameRanges(program, builders) {
  const ranges = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node === null || typeof node !== 'object' || typeof node.type !== 'string') return;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      builders.get(node.callee.name) === 'pgTable'
    ) {
      const [table, columns] = node.arguments;
      if (table?.type === 'StringLiteral') ranges.push([table.start, table.end]);
      for (const property of columns?.type === 'ObjectExpression' ? columns.properties : []) {
        // integer('sort_order').notNull().default(0) : remonter la chaîne jusqu'au constructeur.
        let builder = property.value;
        while (builder?.type === 'CallExpression' && builder.callee.type === 'MemberExpression') {
          builder = builder.callee.object;
        }
        const name = builder?.type === 'CallExpression' ? builder.arguments[0] : undefined;
        if (name?.type === 'StringLiteral') ranges.push([name.start, name.end]);
      }
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(program);
  return ranges;
}

/** Analyse de schéma de chaque programme instrumenté (constructeurs importés, noms SQL). */
const schemaByProgram = new WeakMap();

function schemaOf(program) {
  if (!schemaByProgram.has(program)) {
    const builders = schemaBuilders(program);
    schemaByProgram.set(program, { builders, names: sqlNameRanges(program, builders) });
  }
  return schemaByProgram.get(program);
}

/** Motif 1 : nœud situé dans une déclaration de schéma et qui ne contient aucun nom SQL. */
const drizzleSchemaMetadata = {
  shouldIgnore(path) {
    const program = path.isProgram() ? path.node : path.findParent((p) => p.isProgram())?.node;
    if (program === undefined) return undefined;
    const { builders, names } = schemaOf(program);
    if (builders.size === 0) return undefined;
    const inDeclaration = path.findParent(
      (p) =>
        p.isCallExpression() &&
        p.node.callee.type === 'Identifier' &&
        builders.has(p.node.callee.name),
    );
    if (inDeclaration === null) return undefined;
    const { start, end } = path.node;
    if (typeof start !== 'number' || typeof end !== 'number') return undefined;
    const containsName = names.some(([nameStart, nameEnd]) => start <= nameStart && nameEnd <= end);
    return containsName ? undefined : SCHEMA_REASON;
  },
};

/** Motif 2 : premier argument littéral de `new Logger(…)`. */
const logContext = {
  shouldIgnore(path) {
    const { node, parent } = path;
    const literal = node.type === 'StringLiteral' || node.type === 'TemplateLiteral';
    const isLoggerContext =
      literal &&
      parent?.type === 'NewExpression' &&
      parent.callee.type === 'Identifier' &&
      parent.callee.name === 'Logger' &&
      parent.arguments[0] === node;
    return isLoggerContext ? LOG_CONTEXT_REASON : undefined;
  },
};

/** Greffons de ce fichier (même forme que `declareValuePlugin` de @stryker-mutator/api). */
export const strykerPlugins = [
  { kind: 'Ignore', name: 'drizzle-schema-metadata', value: drizzleSchemaMetadata },
  { kind: 'Ignore', name: 'log-context', value: logContext },
];

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
  // Le dernier est ce fichier : il apporte les deux greffons d'exclusion par motif (plus haut).
  plugins: [
    import.meta.resolve('@stryker-mutator/vitest-runner'),
    import.meta.resolve('@stryker-mutator/typescript-checker'),
    import.meta.url,
  ],
  ignorers: ['drizzle-schema-metadata', 'log-context'],

  // Lanceur Vitest : il reprend la configuration Vitest du paquet (plugin SWC d'unplugin-swc
  // compris, nécessaire aux métadonnées de décorateurs de Nest) et force lui-même un seul fil par
  // processus, sans couverture v8 (la mesure de `pnpm test:coverage` n'est pas touchée).
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },

  // Phases 1 et 2 : tests unitaires seulement (projet Vitest « unit »). Le lanceur ne transmet pas
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

  // Seuils (phase 2, lot 12). Stryker compare `break` au score TOTAL, non arrondi :
  //   score total   = (tués + timeouts) / (tués + timeouts + survivants + sans couverture) ;
  //   score couvert = (tués + timeouts) / (tués + timeouts + survivants), sans les mutants qu'aucun
  //   test unitaire n'exécute (« sans couverture »), affiché pour information seulement.
  // Erreurs de compilation et mutants ignorés (équivalents, motifs) sortent des deux. Le score
  // total compte donc la réserve de la phase 3 : 384 mutants sans couverture unitaire (code
  // exécuté par les seuls e2e : seeds, migrations réelles, démarrage de l'application) et 180
  // survivants qui relèvent des e2e (169 noms de tables et de colonnes du schéma, 11 filtres
  // `published` et constantes HTTP de create-app.ts) ; s'y ajoutent les 6 équivalents déclarés
  // « survivant déclaré » de stryker.equivalents.json et 1 survivant renvoyé « à tester »
  // (problem-details.ts:53). Lot 12 : 393 détectés sur 964, 40,77 % (couvert : 67,76 %).
  // Lot 14 (L14-03) : 42, minimum de deux mesures (45,64 % à 15 processus, 42,03 % à 6) ; le nombre de
  // timeouts, comptés détectés, varie avec la charge (57 contre 20).
  // `break` = score obtenu arrondi à l'entier inférieur, relevé à chaque progrès, JAMAIS abaissé ;
  // `low` = `break` (rouge = échec) ; `high` = 80 (défaut de Stryker), visé après la phase 3.
  thresholds: { high: 80, low: 42, break: 42 },

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
