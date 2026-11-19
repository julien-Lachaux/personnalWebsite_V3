# Lot 11 : test par mutation, phase 1, mesure de référence (compte rendu du lead-architecte)

Branche `lot/11-mutation-mesure` depuis `v3/backend` (HEAD `fe55dde`), 19 novembre 2026.
Décision de Julien du même jour (cadrage validé) : Stryker Mutator en trois lots ; ce lot est la
phase 1, une MESURE : aucun seuil, aucun test ajouté pour tuer des mutants, aucun mutant
équivalent déclaré. Autorisation « config » 52f1416d (ticket MUT-1). Isolation Docker :
`siteperso-v3-lot11`, ports 5752 / 5753.

## Fait

1. **Versions** (`chore: épingle Stryker…`). `pnpm view` le 19 nov. 2026 : `@stryker-mutator/core`,
   `vitest-runner`, `typescript-checker` en 10.1.1 (publiées le 23 oct. 2026 ; pairs :
   `vitest >=2.0.0`, `typescript >=3.6`, Node `>=22`). Épinglées exactement en devDependencies de
   `@siteperso/api` et `@siteperso/contracts`, rien d'installé globalement.
2. **Configuration** `stryker.config.mjs` commentée par paquet : `mutate` = `src/**/*.ts` hors
   `*.spec.ts` (et `*.fixtures.ts` pour les contrats) ; lanceur Vitest sur la configuration Vitest
   existante (SWC compris) ; vérificateur TypeScript ; `coverageAnalysis: 'perTest'` ; rapports
   `html`, `json`, `clear-text` (+ `progress`) dans `reports/mutation/` (gitignoré) ; aucun seuil,
   aucune exclusion par motif. Trois ajustements, chacun prouvé par un échec :
   - greffons chargés par `import.meta.resolve` : avec pnpm, le motif par défaut
     `@stryker-mutator/*` ne voit que les voisins de `core` dans le magasin (« Cannot find Checker
     plugin "typescript" ») ;
   - sandbox à la racine (`.stryker-tmp-api`, `.stryker-tmp-contracts`), à la même profondeur que
     le paquet : dans la sandbox par défaut (`apps/api/.stryker-tmp/sandbox-x`), `src/cli/paths.ts`
     ne trouve plus `db/` (échec du test « pointe migrations et seeds sur db/ » au dry run) ;
   - `tsconfig.stryker.json` (= `tsconfig.json`, `extends` en tableau) pour le vérificateur :
     Stryker réécrit un `extends` chaîne sortant du paquet en préfixant `../..`, faux pour une
     sandbox à la racine (« [TSCONFIG_ERROR] Failed to load tsconfig
     '../../../../tsconfig.base.json' »).
3. **Projet e2e écarté sous Stryker** (`fix: e2e écartés…`, Justification-test MUT-1). Le lanceur
   Vitest de Stryker ne transmet pas `--project`. Première tentative avec l'option Stryker
   `testFiles: ['src/**/*.spec.ts']` : mesure FAUSSE, 1 mutant statique tué sur 286. Cause lue dans
   `@stryker-mutator/core/dist/src/mutants/mutant-test-planner.js` : avec `testFiles`, un mutant
   statique reçoit un `testFilter` et donc `mutantActivation: 'runtime'`, il n'est activé qu'après
   le chargement des modules. Preuve : `stryker run --mutate "src/cli/paths.ts:6-9"` donne 3
   survivants avec `testFiles`, 3 tués sans ; dans la sandbox, `__STRYKER_ACTIVE_MUTANT__=0 vitest
   run --project unit src/cli/paths.spec.ts` échoue bien (1 test). Correction :
   `apps/api/vitest.config.ts` filtre ses projets sur `unit` quand `STRYKER_MUTATOR_WORKER` est
   défini (variable posée par Stryker dans ses seuls processus enfants). Hors Stryker rien ne
   change : `vitest list` donne 263 entrées e2e sans la variable, 0 avec ; `pnpm check` (unit, e2e,
   couverture fusionnée 100 %) vert, voir Vérification.
4. **Commandes** (`chore: commande test:mutation…`, Justification-test MUT-1) : `test:mutation`
   = `stryker run` dans chaque paquet ; racine `turbo run test:mutation --concurrency=1` (un paquet
   à la fois : Stryker occupe déjà n-1 cœurs) ; tâche turbo `dependsOn: ["^build"]`,
   `cache: false` (mesure dont on veut résultat et durée réels ; Stryker travaille hors du paquet,
   turbo ne hacherait pas ses vraies entrées). Hors `pnpm check`, hors pre-commit, hors CI.
5. **Garde-fous** (`chore(garde-fous): …`, Justification-test MUT-1). Motif « config »
   `(^|/)(\.|tsconfig\.)?stryker(\.x)*\.(json|[cm]?[jt]s)` dans `.claude/hooks/lib/policy.mjs` et
   `CONFIG_RE` de `scripts/ci/check-tests-integrity.sh` : `stryker.config.mjs` et toutes les
   variantes que Stryker lit, `tsconfig.stryker.json`, futur `stryker.equivalents.json`. Nouveau
   test `.claude/hooks/tests/stryker-oracles.test.mjs` (11 cas, lancé par `pnpm hooks:test`) :
   classement, refus PreToolUse, autorisation nominative, et script d'intégrité exercé dans un
   dépôt git temporaire. README des hooks et rappel de démarrage complétés.
6. **Mesure** (ci-dessous) puis **docs** : `docs/02` (ligne Tests), `CLAUDE.md` (une ligne dans
   Commandes, une puce dans Conventions), `README.md` (une ligne).
7. `fix: rapports de mutation ignorés…` : `reports/mutation/` contenant une barre était ancré à la
   racine ; corrigé en `**/reports/mutation/` (preuve : `git check-ignore -v`).

## Scores (mesure de référence, unitaires seulement)

Machine : AMD Ryzen 7 3700X, 8 cœurs / 16 fils, 15 Gio, WSL2 (Linux 6.18), Node 26.13.1.
Stryker : 8 vérificateurs + 7 lanceurs (concurrence par défaut n-1). Score = (tués + timeouts) /
(tués + timeouts + survivants + sans couverture) ; les erreurs de compilation (mutants refusés par
le vérificateur TypeScript) sont hors score.

| Paquet               | Mutants | Tués | Timeouts | Survivants | Sans couverture | Erreurs de compilation | Score   | Score couvert | Durée                    |
| -------------------- | ------: | ---: | -------: | ---------: | --------------: | ---------------------: | ------: | ------------: | ------------------------ |
| `packages/contracts` |     483 |  134 |        0 |        284 |               0 |                     65 | 32,06 % |       32,06 % | 3 min 38 s (220 s murs)  |
| `apps/api` (unit)    |    1598 |  322 |       20 |        329 |             387 |                    540 | 32,33 % |       50,97 % | 8 min 41 s (524 s murs)  |

Commandes : `pnpm --filter @siteperso/contracts test:mutation`, `pnpm --filter @siteperso/api
test:mutation`, puis `pnpm test:mutation` à la racine (les deux, via turbo, `cache bypass`) :
scores identiques au mutant près, 3 min 9 s + 8 min 1 s, 11 min 16 s au total. Rapports :
`packages/contracts/reports/mutation/mutation.{html,json}`, `apps/api/reports/mutation/…`
(présents, ignorés par git). Mesure FAUSSE écartée (avec `testFiles`) : API 28,45 %, 370
survivants dont 285 statiques.

Remarques de lecture :

- Mutants statiques (exécutés au chargement d'un module : schémas Zod, tables Drizzle, constantes) :
  98 % des mutants des contrats, 26 % de l'API (408), estimés à 91 % du temps de l'API.
- `sans couverture` (387, API) : code que seuls les e2e exécutent (`seeds-convergence` 123,
  `deleted-entities` 91, `seeds-runner` 39, `create-app` 37, `migrations-runner` 33,
  `provision-api-role` 33, `reset-database` 13, dépôts Drizzle 16…). La couverture à 100 % est
  fusionnée unit + e2e ; la mutation de phase 1 ne voit que les unitaires.
- Le dry run de l'API exécute 312 tests sur 315 : `architecture.spec.ts` (3 tests) lit les sources
  sur disque sans les importer, Vitest (`related`) ne le rattache à aucun fichier muté. Sans effet
  sur les scores.
- 20 timeouts (19 dans `sql-statements.ts`) : boucles rendues infinies, comptées détectées.

## Classement des survivants

Classement heuristique (script sur `mutation.json`, règles par fichier, mutateur et texte),
contrôlé par échantillon ; les effectifs sont des ordres de grandeur, pas un inventaire signé.

### `packages/contracts` (284 survivants)

| Cause                       | Effectif | Exemples (fichier:ligne, mutant) |
| --------------------------- | -------: | -------------------------------- |
| Message ou libellé          |      259 | `src/openapi/document.ts:163` `'Trop de requêtes : limite de débit atteinte pour cette IP.'` → `""` ; `src/profile/profile.ts:16` `.meta({ examples: ['Prénom'] })` → `.meta({})` ; `src/common/locale.ts:10` description de `lang` → `""` |
| Assertion absente ou faible |       25 | `src/openapi/document.ts:66` `operationId: 'getProfile'` → `""` ; `src/common/url.ts:8` `/^https?$/` → `/^https?/` ; `src/education/education.ts:26` `path: ['yearEnd']` → `[]` (le refus est testé, pas le champ en faute) |
| Branche défensive non testée |       0 | — |
| Code équivalent probable    |        0 | — (aucun relevé ; `sortComponents: 'alphabetically'` → `{}` est classé faible : l'ordre des composants n'est pas vérifié) |
| Autre                       |        0 | — |

### `apps/api`, unitaires (329 survivants)

| Cause                                | Effectif | Exemples (fichier:ligne, mutant) |
| ------------------------------------ | -------: | -------------------------------- |
| Autre : relève des e2e (SQL réel, HTTP) |    239 | `src/infrastructure/db/schema/languages.ts:10` `text('slug')` → `text("")` ; `src/infrastructure/db/experiences/drizzle-experiences.repository.ts:44` `eq(experiences.published, true)` → `false` ; `src/infrastructure/http/create-app.ts:28` `"default-src 'none';frame-ancestors 'none'"` → `""` |
| Code équivalent probable             |       42 | `src/infrastructure/db/schema/tools.ts:16` `index('tools_published_sort_order_idx')` → `index("")` (métadonnée Drizzle jamais lue : le SQL fait foi) ; `src/infrastructure/db/schema/certifications.ts:23` `.default(true)` → `.default(false)` (idem) ; `src/infrastructure/db/drizzle-database-client.ts:57` `clearTimeout(timer)` → supprimé (minuterie résiduelle non observable) |
| Assertion absente ou faible          |       25 | `src/application/experiences/list-experiences.use-case.ts:31` `achievements: [...experience.achievements]` → `[]` ; `src/infrastructure/db/sql-statements.ts:25` `char === '-' && next === '-'` → `\|\|` ; `src/infrastructure/config/env.schema.ts:66` `.min(100)` → `.max(100)` |
| Message ou libellé                   |       15 | `src/infrastructure/http/health/health.controller.ts:14` `'La base de données est injoignable.'` → `""` ; `src/infrastructure/http/problem/problem-details.ts:11` `406: 'Not Acceptable'` → `""` ; `src/infrastructure/http/problem/send-problem.ts:7` `new Logger('ProblemDetails')` → `new Logger("")` |
| Branche défensive non testée         |        8 | `src/infrastructure/http/problem/problem-details.ts:31` `code >= 400 && code <= 599` → `code < 599` ; `src/infrastructure/http/problem/problem-details.ts:53` `typeof response === 'object' && 'message' in response` → `true` ; `src/infrastructure/db/migrations-runner.ts:189` `if (tables[0]?.present)` → `if (true)` |

Les 239 « relève des e2e » sont surtout les tables Drizzle (noms de tables et de colonnes,
`mode`, références) que `test/db/schema-matches-db.e2e-spec.ts` compare à `information_schema`,
les filtres `published`/`deleted_at` des dépôts, les constantes HTTP de `create-app.ts` : des
mutants que les e2e tueraient, invisibles pour des unitaires sans base.

## Estimation d'un passage e2e (phase 3)

`pnpm --filter @siteperso/api test:e2e` sur la base isolée (39 fichiers, 544 tests, un seul
processus, une seule base) : 104,5 s, 103,0 s, 105,4 s, moyenne **103,4 s**.

Mutants testables de l'API (hors erreurs de compilation) : 1058, dont 286 statiques et 772 à
l'exécution (dont les 387 aujourd'hui sans couverture).

- Statiques : chacun relance tous les e2e liés (tous importent `createApp`) : 286 × 103 s ≈ **8,2 h**
  au plus (le premier échec arrête le passage d'un mutant tué).
- À l'exécution : seuls les e2e qui couvrent le mutant ; un e2e traverse toute la pile, la
  sélection reste large. Hypothèse 10 à 30 % de la suite + 3 à 5 s de démarrage par passage :
  772 × 15 à 35 s ≈ **3 à 7,5 h**.
- Total ≈ **11 à 16 h avec une seule base (concurrence 1)**, contre 8 min 41 s pour les unitaires.
  Avec une base par processus Stryker (nom dérivé de `STRYKER_MUTATOR_WORKER`, 7 lanceurs) :
  ≈ **2 à 3 h**. Avec `ignoreStatic` en plus : environ 8 h de moins en concurrence 1, au prix des
  mutants de schéma Drizzle non mesurés.

## Recommandations pour la phase 2

- **Seuil de rupture** proposé = score obtenu : `thresholds.break` 32 pour chaque paquet
  (contrats 32,06 %, API 32,33 %), relevé à chaque lot qui tue des survivants.
- **Contrats** : un test d'instantané du document OpenAPI généré (`createOpenApiDocument()`
  comparé à un fichier de référence versionné) tuerait l'essentiel des 259 libellés ET des
  `operationId`, plutôt que de les exclure : le texte du contrat est un livrable.
- **API, assertions faibles** (25) et **branches défensives** (8) : à tuer par des unitaires
  (`sql-statements`, `env.schema`, `problem-details`, `list-experiences`).
- **Motifs d'exclusion à confirmer par Julien** (aucun appliqué en phase 1) :
  1. métadonnées Drizzle jamais lues à l'exécution (`index(…)`, `.default(…)`, `{ enum }` des
     tables de `infrastructure/db/schema`) : équivalents par construction (le SQL fait foi) ;
     proposition : les déclarer dans `stryker.equivalents.json` ou un ignorer Stryker ciblé ;
  2. contexte de journal `new Logger('…')` ;
  3. libellés HTTP (titres RFC 9457, détails) : à tuer plutôt qu'exclure, ils sont dans les réponses.
- **Portée de la règle** : sur les unitaires seuls, 239 survivants et 387 sans couverture de
  l'API relèvent des e2e ; imposer « aucun survivant non justifié » à `infrastructure/db` et
  `create-app` avant la phase 3 obligerait à des justifications en masse. Proposition : règle
  phase 2 sur `packages/contracts`, `src/application`, `src/domain`, `src/cli`,
  `infrastructure/config` et `infrastructure/http/problem`, le reste avec la phase 3.

## Décisions

- `testFiles` écarté au profit d'un filtre de projets dans `vitest.config.ts` : `testFiles`
  fausse la mesure des mutants statiques (preuve ci-dessus). Alternative écartée : un
  `vitest.mutation.config.ts` dédié, nouveau fichier de configuration protégé hors du périmètre de
  l'autorisation MUT-1 et doublon de configuration.
- Sandbox à la racine plutôt qu'`inPlace: true` : `inPlace` muterait les sources de l'arbre de
  travail pendant le passage (risque en cas d'arrêt brutal, hooks git, autres outils).
- `tsconfig.stryker.json` plutôt que modifier `tsconfig.json` : effet limité à Stryker, explicite.
- Aucune exclusion par motif en phase 1 : la mesure de référence est brute ; les motifs sont des
  propositions pour la phase 2.
- Test du script d'intégrité CI placé dans `.claude/hooks/tests/` : `integrity:test` et la CI
  n'exécutent qu'un fichier nommé de `scripts/ci/tests/`, que ce lot ne modifie pas.

## Vérification

- `pnpm hooks:test` : 41 tests, 0 échec (dont les 11 nouveaux).
- `pnpm integrity` : « Intégrité des tests : OK » (Justification-test MUT-1 sur chaque commit
  touchant une configuration protégée).
- `pnpm check` deux fois sur base de test neuve (`docker compose down -v` avant chacun) : vert
  (206 s, 202 s) ; hooks 41/41, intégrité 19/19 et OK, contrats 104 tests, API 315 unitaires +
  544 e2e, couverture fusionnée de l'API 76 fichiers / 859 tests et des contrats à 100 % sur les
  quatre métriques : la couverture n'est pas changée par le filtre de projets.
- `pnpm db:down` en fin de lot, aucun conteneur `siteperso-v3-lot11` restant.
- `git check-ignore -v packages/contracts/reports/mutation/mutation.html
  apps/api/reports/mutation/mutation.json .stryker-tmp-api/x` : ignorés.

## Non fait

- Aucun test ajouté, aucun mutant équivalent déclaré, aucun seuil : hors phase 1.
- Durée d'un passage e2e : estimée, pas mesurée par Stryker (phase 3).

## Points ouverts

- **Défaut de Stryker 10.1.1** : `testFiles` + mutants statiques (activation `runtime`). À signaler
  en amont ; tant qu'il existe, ne pas utiliser `testFiles`.
- **Chevauchement avec le lot 10** : `package.json` racine (script `test:mutation` ajouté sous
  `test:coverage`), `CLAUDE.md` section Commandes (une ligne sous `pnpm test:coverage`). Conflits
  textuels possibles à la fusion, sans conflit de fond. `docs/deploiement.md` et
  `.github/workflows/ci.yml` non touchés.
- **Durée** : un passage complet `pnpm test:mutation` ≈ 11 à 12 min sur cette machine (16 fils) ;
  sur un exécuteur de CI à 4 cœurs, compter 3 à 4 fois plus : à arbitrer avant toute entrée en CI
  (phase 2), par exemple en mode `incremental` de Stryker.
