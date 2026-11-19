# Lot 7 : couverture de test à 100 % (compte rendu de l'agent de développement)

Branche `lot/7-couverture-100` depuis `v3/backend` (HEAD `5ca8dea`). Décision de Julien du
19 novembre 2026, appliquée sans la rediscuter : couverture de 100 % sur les quatre métriques
(lignes, branches, fonctions, instructions) pour toute la base de code, unitaires et e2e
cumulés, mesurée en une passe fusionnée, publiée et imposée par un seuil en local (`pnpm check`)
et en CI.

## Fait

1. **Mesure fusionnée** (`fa56856`). Fonctionnalité « projects » de Vitest 5.1.1 dans
   `apps/api/vitest.config.ts` : projet `unit` (`src/**/*.spec.ts`) et projet `e2e`
   (`test/**/*.e2e-spec.ts`, `globalSetup`, `fileParallelism: false`, lecture du `.env` racine et
   de `POSTGRES_TEST_PORT` comme avant), une seule configuration `coverage` racine : provider v8,
   `include: src/**/*.ts`, `exclude: **/*.spec.ts` uniquement, reporters `text`, `text-summary`,
   `json-summary`, `lcov`, seuils 100/100/100/100. `vitest.e2e.config.ts` supprimé ;
   `pnpm test` = `vitest run --project unit`, `pnpm test:e2e` = `--project e2e`,
   `pnpm test:coverage` = `vitest run --coverage` (les deux projets, couverture fusionnée).
   `packages/contracts` : même configuration de couverture (hors `*.spec.ts` et `*.fixtures.ts`),
   `@vitest/coverage-v8` 5.1.1 en devDependency. Tâche turbo `test:coverage` (`dependsOn: ^build`,
   `cache: false`), script racine, ajoutée à `pnpm check`.
2. **100 % atteint** sans exclusion de fichier de production ni commentaire d'ignore, en neuf
   commits atomiques :
   - `33ba6c8` unitaires `sql-statements` (dollar seul, délimiteurs non refermés) et
     `send-problem` (valeur levée non-Error, pile journalisée, en-têtes, 4xx non journalisée) ;
   - `cdd43c0` `provisionApiRole` : les trois `select` sans `from` typés en tuple à un élément,
     les replis `?.`/`?? ''` jamais atteignables disparaissent (code mort supprimé, pas testé) ;
   - `373ce64` `seeds-convergence` : table de traductions explicite (`translations` + `links`)
     au lieu d'une recherche par suffixe, `continue` inatteignable supprimé ;
   - `0f15a75` e2e seeds : migration en attente refusée sans rien appliquer, extrait de
     l'instruction fautive cité en entier (court) ou tronqué à 200 caractères + « … » (long) ;
   - `0335f63` e2e schéma : clés étrangères Drizzle (`.references(() => …)`, `on delete`)
     comparées à `information_schema` ; exerce les fermetures de référence que l'application
     n'appelle jamais, sur leur contenu réel ;
   - `8774c41` e2e client Drizzle : `ping` vrai sur base joignable, NOTICE PostgreSQL non écrit
     sur la console (cas témoin avec le driver nu, qui l'écrit) ;
   - `aadc0ea` e2e `createApp()` sans option : niveaux error/warn/log actifs, debug/verbose coupés ;
   - `4ecf15e` unitaires CLI : `paths.ts` (répertoires, `log`, `databaseUrl`, `runCli` succès /
     Error / valeur brute, `exitCode`), `migrate`, `seed`, `reset`, `provision-api-role` importés
     avec `vi.mock` des runners (options transmises, rôle par défaut / `API_DB_USER`,
     `API_DB_PASSWORD` absent ou vide refusé, sortie en erreur). Aucune restructuration des points
     d'entrée n'a été nécessaire : l'import dynamique après `vi.mock` couvre le `await` de tête ;
   - `86e6daf` unitaire `main.ts` : `createApp` remplacé, lecture d'`APP_CONFIG`, `listen` sur
     PORT/HOST, annonce de l'URL par le Logger.
3. **CI** (`a278c7b`) : le job e2e lance `pnpm test:coverage` (échoue sous 100 %), écrit un
   tableau par paquet dans `GITHUB_STEP_SUMMARY` depuis les `coverage-summary.json`, dépose les
   deux `lcov.info` en artefact (`actions/upload-artifact` v7.0.2 épinglé par SHA, 14 jours), puis
   garde la seconde passe e2e en ordre aléatoire (`--project e2e`). `coverage/` déjà gitignoré.
4. **Docs** (`c68b0ce`) : CLAUDE.md (conventions de code : projets Vitest, couverture 100 %
   obligatoire, pas d'ignore, points d'entrée testés par import, commandes) et README (section
   Qualité).
5. **Vérification finale** : `docker compose down -v` puis `pnpm check` deux fois de suite sur
   base de test neuve, les deux verts (lint, typecheck, unit, e2e, couverture des deux paquets).
   La première tentative avait révélé que turbo lançait `test:e2e` et `test:coverage` en
   parallèle sur la même base : corrigé par `031dc1c` (`pnpm check` en deux invocations turbo,
   voir « Décisions »).

## Couverture avant / après (apps/api, src/**/*.ts complet)

| Mesure                                   | Lignes  | Branches | Fonctions | Instructions |
| ---------------------------------------- | ------- | -------- | --------- | ------------ |
| Avant : unitaires seuls, périmètre réduit | 88 %    | n. c.    | n. c.     | n. c.        |
| Avant : e2e seuls, tout src/             | 90,2 %  | 80,7 %   | 87,9 %    | n. c.        |
| Avant : première passe fusionnée (lot 7) | 92,15 % | 89,83 %  | 89,22 %   | 92,4 %       |
| Après                                    | 100 %   | 100 %    | 100 %     | 100 %        |

`text-summary` final :

```
apps/api (67 fichiers de test, 776 tests)
Statements   : 100% ( 614/614 )
Branches     : 100% ( 181/181 )
Functions    : 100% ( 231/231 )
Lines        : 100% ( 595/595 )

packages/contracts (17 fichiers de test, 104 tests)
Statements   : 100% ( 51/51 )
Branches     : 100% ( 2/2 )
Functions    : 100% ( 7/7 )
Lines        : 100% ( 48/48 )
```

## Non fait

- Rien du périmètre demandé ne manque. `docs/02-stack-technique.md` et `docs/backlog.md` sont hors
  périmètre : voir « À écrire ailleurs ».

## Décisions

- **Projets Vitest plutôt que fusion externe** : la fonctionnalité `test.projects` de Vitest 5
  fusionne nativement la couverture des deux projets ; aucun outil de fusion (nyc, istanbul-merge)
  n'a été ajouté. Les options propres aux e2e (`globalSetup`, `env`, `fileParallelism`,
  délais) sont acceptées au niveau projet ; `coverage` ne l'est qu'au niveau racine, ce qui est
  exactement le besoin.
- **Code mort supprimé plutôt que testé** (`provisionApiRole`, `seeds-convergence`) : des replis
  qu'aucune exécution ne pouvait atteindre ; le typage (tuple à un élément, champ explicite) porte
  l'invariant à la place d'une branche défensive.
- **Fermetures de référence du schéma Drizzle** : testées plutôt que supprimées, car elles ne sont
  pas inutiles (elles décrivent les clés étrangères que la base porte réellement) ; le test les
  compare à `information_schema`, ce qui détecte un schéma Drizzle désynchronisé du SQL.
- **Seconde passe e2e aléatoire conservée en CI** après la passe de couverture.
- **`pnpm check` en deux invocations turbo** (`lint typecheck test test:e2e`, puis
  `test:coverage`) : dans une seule invocation, turbo lance `test:e2e` et `test:coverage` de
  l'API en parallèle sur la même base de test, et chacun recrée le schéma sous les pieds de
  l'autre (constaté : `relation "profile" does not exist`, 16 fichiers e2e en échec). Une
  dépendance `dependsOn: ["test:e2e"]` aurait aussi sérialisé, mais aurait fait rejouer les e2e
  deux fois dans la CI, où seul `test:coverage` est lancé.

## À écrire ailleurs (hors périmètre de l'agent)

- `docs/02-stack-technique.md` : tests = deux projets Vitest (`unit`, `e2e`) dans une seule
  configuration, couverture v8 fusionnée avec seuil 100 % sur les quatre métriques, règle « pas
  d'ignore, pas d'exclusion de production », rapports `lcov`/`json-summary` en CI.
- `docs/backlog.md` : clore L4-07 (périmètre réduit de couverture) remplacé par la règle 100 % ;
  noter que `vitest.e2e.config.ts` n'existe plus (`--project e2e`).

## Points ouverts

- **Hook pre-commit et pnpm 10** : `.husky/pre-commit` appelle `pnpm turbo …` ; husky n'ajoute au
  PATH que `node_modules/.bin` (relatif), et turbo relance `pnpm` depuis chaque paquet. Sur une
  machine dont le `pnpm` global est en 9.x, le hook échoue (`ERR_PNPM_BAD_PM_VERSION`). Pour ce
  lot, des liens symboliques locaux (gitignorés) vers pnpm 10 ont été posés dans
  `node_modules/.bin` de la racine et des deux paquets. Solution propre côté hôte :
  `~/.config/husky/init.sh` qui met pnpm 10 en tête du PATH, ou pnpm 10 global.
- **Durée de `pnpm check`** : la passe de couverture rejoue les e2e (environ 70 s de plus). Si
  cela pèse, `pnpm check` pourrait ne lancer que `test:coverage` (qui exécute déjà unitaires et
  e2e) au lieu de `test` + `test:e2e` + `test:coverage` ; conservé tel quel pour garder les trois
  sorties distinctes dans le journal.
- Le reporter `text` de Vitest 5 n'affiche plus les fichiers entièrement couverts (« No files with
  missing coverage ») ; le détail par fichier reste dans `coverage/lcov-report/`.
