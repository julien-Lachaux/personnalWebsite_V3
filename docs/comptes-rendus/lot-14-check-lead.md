# Lot 14, étape b : `pnpm check` sans doublon, e2e de l'API en parallèle, formatage avant le push (lead-architecte)

Date : 20 nov. 2026. Branche `lot/14-garde-fous-ci` (worktree
`.claude/worktrees/lot-14-garde-fous-ci`), partie b, après la partie a de dev-api (69bd65e).
Isolation : `.env` racine `siteperso-v3-lot14`, ports 5742 à 5745 ; `apps/api/.env` sur 5742.
Autorisation de configuration **fc244fc2** : `apps/api/vitest.config.ts`, `.husky/**`, `turbo.json`.
Tickets L14-15 (configuration), L14-16, L14-09. Fichiers modifiés : `apps/api/vitest.config.ts`,
`turbo.json`, `package.json` (racine), `.husky/pre-commit`, `CLAUDE.md` ; ajoutés :
`.husky/check-staged-format.mjs`, `.husky/tests/check-staged-format.test.mjs`. Rien dans
`.claude/`, `scripts/ci/`, `.github/`, configurations Stryker et Playwright, tests existants.
Journaux dans le dossier temporaire de session, préfixés `check-lot14b-`.

## Fait

| Ticket | Commit | Livré |
|---|---|---|
| L14-15 | bc98b8d | Projet e2e de `apps/api/vitest.config.ts` : `fileParallelism: false` retiré, commentaires du `globalSetup` et d'en-tête repris. `maxWorkers` par défaut de Vitest. Condition Stryker `mutationRun`, seuils, `include`, délais et `env` inchangés. |
| L14-09 | 53bea32 | `.husky/check-staged-format.mjs` (`pnpm format:staged`) en tête du pre-commit ; 13 tests (`pnpm husky:test`) ; `husky:test` et `format:check` dans `pnpm check`. |
| L14-16 | bf76957 | `turbo.json` : `@siteperso/web#test:e2e` attend `test:coverage` du front au lieu de `test`. |
| L14-16 | 87eb6ff | `pnpm check` : `turbo run lint typecheck test:coverage @siteperso/web#test:e2e` (une invocation) au lieu de `turbo run lint typecheck test test:e2e && turbo run test:coverage`. |
| docs | 7539f90 | `CLAUDE.md` : description de `pnpm check`, e2e en parallèle (structure, conventions de test), commandes `husky:test`, `format:check`, `format:staged`, pre-commit. |

### L14-15 : nombre de processus

Décision : **`maxWorkers` par défaut de Vitest** (`vitest run` : cœurs disponibles moins un,
`availableParallelism()`, donc l'affinité CPU est respectée), sans borne écrite dans la
configuration.

Mesures (`pnpm exec vitest run …` dans `apps/api`, au mur, 16 cœurs, mémoire « libre + tampons +
cache » minimale relevée par `vmstat` chaque seconde ; machine partagée avec d'autres sessions) :

| Commande | Processus | Durée | Mémoire libre minimale | Tests |
|---|---|---|---|---|
| `--project e2e` | 15 (défaut) | 27 s, puis 19 s | 7,7 à 7,8 Go | 764 |
| `--project e2e --maxWorkers=8` | 8 | 23 s, puis 32 s | 6,0 à 9,0 Go | 764 |
| `--project e2e --maxWorkers=4` | 4 | 35 s | 9,4 Go | 764 |
| `--project e2e --maxWorkers=2` | 2 | 59 s | 9,8 Go | 764 |
| `--coverage` (les deux projets) | 15 (défaut) | 26 s | 7,7 Go | 1194 |
| `--coverage --maxWorkers=8` | 8 | 39 s | 8,5 Go | 1194 |
| `taskset -c 0-3 … --coverage` (4 cœurs simulés) | 3 | 68 s | | 1194 |
| `taskset -c 0-1 … --coverage` (2 cœurs simulés) | 1 | 197 s | | 1194 |

Référence en série (dev-api, même machine) : 127 à 129 s pour les e2e seuls.

Motifs :
- Au-delà de 8 processus le gain n'est plus mesurable, mais une borne ne fait rien gagner non plus,
  et l'empreinte mémoire du défaut reste modérée (environ 2 Go de plus qu'à 2 processus).
- Une borne propre au projet e2e est impossible sans séparer les projets : Vitest 5.1.1 refuse deux
  `maxWorkers` différents dans un même `sequence.groupOrder` (`groupSpecs`,
  `vitest/dist/chunks/index.ER9afepi.js` l. 6394-6397 : « Projects … have different 'maxWorkers'
  but same 'sequence.groupOrder' »). Il faudrait un groupe par projet, et `pnpm test:coverage`
  enchaînerait unitaires puis e2e au lieu de répartir les 117 fichiers sur les mêmes processus.
- Une borne globale (`maxWorkers: '50%'`, par exemple) s'appliquerait aussi aux unitaires et
  priverait une machine plus grosse du gain, sans défaut constaté à corriger.
- Le défaut suit la machine : 3 processus sur un exécuteur à 4 cœurs, 1 sur 2 cœurs (exécuteur
  `ubuntu-latest` d'un dépôt privé), où la durée revient à celle de la série d'avant.

Couverture fusionnée : mêmes totaux avant et après (API 765/765 instructions, 232/232 branches,
276/276 fonctions, 745/745 lignes ; contrats 59/2/9/56 ; front 722/414/212/644), 100 % sur les trois
paquets dans chaque `pnpm check`. La passe fusionnée reste une seule invocation de Vitest (les deux
projets dans un même groupe, `VITEST_POOL_ID` de 1 à `maxWorkers`, c'est-à-dire les bases `_w1` à
`_wN` que le `globalSetup` crée d'après `project.config.maxWorkers`).

Stryker : `mutationRun` et le filtre des projets sont intacts (diff de bc98b8d : seules les lignes
`fileParallelism` et les commentaires changent). Le projet e2e reste écarté des processus Stryker.

### L14-16 : chaque test une seule fois

Avant, `pnpm check` lançait deux invocations de Turborepo ; `turbo run … --dry=json` donne :
- première : `contracts#build`, `lint`, `typecheck`, `test` des trois paquets, `api#test:e2e`,
  `web#test:e2e` (et `contracts#test:e2e`, sans script) ;
- seconde : `test:coverage` des trois paquets.

Les tests Vitest tournaient donc deux fois : unitaires (430) et e2e (764) de l'API, contrats (220),
front (682). Après : une invocation, 11 tâches, `contracts#build`, `lint`, `typecheck` et
`test:coverage` des trois paquets, `web#test:e2e`. `api#test:e2e` n'est plus demandé : ses fichiers
sont dans `api#test:coverage` (sans filtre de projet).

`turbo.json` : `web#test:e2e` dépendait de `test` du front (F1 bis, d5be36c, course sur `.nuxt`
entre `nuxt generate` et les lecteurs de `.nuxt`). Demander `web#test:e2e` aurait ajouté `web#test`
au graphe (vérifié : `--dry=json` liste `@siteperso/web#test` avec l'ancien `turbo.json`). Il dépend
désormais de `test:coverage`, qui exécute les mêmes projets Vitest (`unit` et `nuxt`) et lit `.nuxt`
de la même façon : la course reste évitée. `inputs`, `env`, cache inchangés.

Preuve que l'ensemble des tests est le même (journaux `check-lot14b-avant-1.log` et
`check-lot14b-apres-2.log`, lignes « ✓ projet fichier (n tests) » de Vitest et « ✓ [projet] ›
fichier › titre » de Playwright, triées puis comparées par `diff`) :

| Paquet, projet | Avant (exécutions) | Après | Fichiers comparés |
|---|---|---|---|
| API `unit` | 430 tests (62 fichiers) × 2 : `api#test`, `api#test:coverage` | 430 (62) × 1 : `api#test:coverage` | identiques, nombre de tests par fichier compris |
| API `e2e` | 764 (55) × 2 : `api#test:e2e`, `api#test:coverage` | 764 (55) × 1 : `api#test:coverage` | identiques |
| Contrats | 220 (29) × 2 | 220 (29) × 1 : `contracts#test:coverage` | identiques |
| Front `unit` + `nuxt` | 682 (53) × 2 | 682 (53) × 1 : `web#test:coverage` | identiques |
| Front Playwright | 252 × 1 (36 par taille d'écran, 7 tailles) | 252 × 1 | identiques |
| Hooks (`hooks:test`) | 569 | 569 | — |
| Script d'intégrité (`integrity:test`) | inchangé | inchangé | — |
| Pre-commit (`husky:test`) | — | 13 (nouveaux) | — |

`diff` des listes : API (unitaires + e2e séparés d'avant) = couverture d'après ; couverture
d'avant = couverture d'après ; front, contrats, Playwright : identiques, aucune ligne de différence.

Pre-commit : inchangé sur ce point (`pnpm turbo run lint typecheck test`, unitaires seulement),
précédé du formatage. CI : voir « Changements pour dev-devops ».

### L14-09 : formatage avant le push

- `pnpm check` : `pnpm format:check` (tout le dépôt, `prettier --check .`) après les garde-fous et
  avant les conteneurs : 8 s, échoue tôt.
- Pre-commit : `pnpm format:staged` puis `pnpm turbo run lint typecheck test` (husky lance le
  fichier par `sh -e`, la première commande en échec arrête). Le script lit la liste des fichiers
  indexés (`git diff --cached --raw -z --diff-filter=ACMR`) et le **contenu de l'index**
  (`git show :<fichier>`), puis appelle l'API de Prettier (`getFileInfo`, `resolveConfig` avec
  `.editorconfig`, `check`) : un fichier indexé en partie est jugé sur ce qui sera commité. Fichiers
  de `.gitignore` et `.prettierignore` et types sans analyseur écartés, comme la CLI ; suppressions,
  liens symboliques et sous-modules écartés. 0,7 s pour un fichier indexé.
- Démonstration : fichier `apps/api/src/demo-format.ts` non formaté indexé puis `git commit` :
  « Formatage Prettier non respecté dans les fichiers indexés : apps/api/src/demo-format.ts »,
  `husky - pre-commit script failed (code 1)`, aucun commit (HEAD inchangé), fichier retiré ensuite.
- Tests (`.husky/tests/check-staged-format.test.mjs`, dépôts git jetables) : rien d'indexé ;
  formaté ; non formaté (fichier cité) ; `.prettierrc.json` appliqué ; `.editorconfig` lu ; index
  jugé et non l'arbre (dans les deux sens) ; `.prettierignore`, `.gitignore` forcé, type inconnu ;
  fichier non suivi ; suppression et lien symbolique ; modification et renommage ; espaces et
  accents ; lancement depuis un sous-dossier ; même verdict que `prettier --check` sur sept types de
  fichiers. Sensibilité vérifiée hors commit : `editorconfig: false`, lecture de l'arbre au lieu de
  l'index, filtre de mode retiré font chacun échouer un test ; la condition `info.ignored`, redondante
  (`inferredParser` vaut `null` pour un fichier ignoré), a été retirée.
- Aucun paquet ajouté : Prettier 3.10.1 est déjà épinglé et c'est la dernière version stable
  (`pnpm view prettier version`).

## Mesures de `TURBO_FORCE=true pnpm check` (au mur, 16 cœurs)

| Run | Commit | Durée | Charge et remarques |
|---|---|---|---|
| Avant 1 | 69bd65e | 330 s | turbo 171 s puis 128 s |
| Avant 2 | 69bd65e | 337 s | turbo 175 s puis 133 s |
| Après 1 | 87eb6ff | 251 s | le `pnpm check` du worktree `lot-14-hooks` a tourné en même temps à partir de la première minute |
| Après 2 | 7539f90 | 211 s | seul ; turbo 173 s (résumé par tâche ci-dessous) |
| Après 3 | 7539f90 | 211 s | base neuve (`docker compose down -v` avant) ; turbo 167 s |
| Après 4 | 7539f90 | 212 s | base neuve (`docker compose down -v` avant) ; turbo 168 s |

Chemin critique après (résumé Turborepo `TURBO_RUN_SUMMARY=true`, run « après 2 ») :
`web#lint` 113 s (ESLint typé des `.vue`, en concurrence avec le reste) puis `web#test:e2e` 55 s
(`nuxt generate` + 252 parcours) ; en parallèle `api#test:coverage` 41 s, `web#test:coverage` 28 s,
`api#lint` 44 s, `web#typecheck` 39 s, `api#typecheck` 37 s. Les e2e de l'API ne sont plus sur le
chemin critique ; avant, `api#test:e2e` (128 s) dominait la première invocation, et la passe de
couverture (122 s) s'y ajoutait entièrement.

## Critères et preuves

| Critère | Preuve |
|---|---|
| Mêmes tests exécutés et verts | `diff` des listes de fichiers et de parcours (tableau L14-16) ; « après 3 » et « après 4 » : API 1194 (430 unitaires + 764 e2e, 117 fichiers), contrats 220, front 682, Playwright 252, hooks 569, pre-commit 13, tous verts |
| Couverture 100 % sur les trois paquets | lignes « Coverage summary » de chaque journal « après » : API 765/232/276/745, contrats 59/2/9/56, front 722/414/212/644, mêmes dénominateurs qu'avant |
| `TURBO_FORCE=true pnpm check` vert | « après 3 » puis « après 4 », chacun précédé de `docker compose down -v` (base de test neuve), `exit 0` |
| Aucun oracle affaibli | aucun test existant touché ; seuils, `include`, délais, `env` et `mutationRun` de `apps/api/vitest.config.ts` inchangés ; aucune tâche de test retirée (graphe `--dry=json`) ; `pnpm integrity` vert dans chaque `pnpm check` (Justification-test sur bc98b8d, 53bea32, bf76957, 87eb6ff) |
| Pre-commit : formatage des fichiers indexés | démonstration du refus ci-dessus ; `pnpm husky:test` 13/13 |

## Changements pour dev-devops (étape c, `.github/` non touché)

1. **Tests du pre-commit en CI** : ajouter `pnpm husky:test` au job `qualite` (qui installe les
   dépendances : les tests chargent Prettier depuis `node_modules`), pas au job `garde-fous` (sans
   `pnpm install`).
2. **Rien à changer pour ne rien perdre** : le job `e2e` lance déjà `pnpm test:coverage` (unitaires
   et e2e de l'API, désormais en parallèle), puis la passe en ordre aléatoire
   (`--sequence.shuffle.files`) ; le job `front` lance `lint typecheck test:coverage test:e2e
   --filter=@siteperso/web`. Avec bf76957, `web#test` n'est plus ajouté à ce job (doublon retiré) et
   `nuxt generate` attend `web#test:coverage` (course sur `.nuxt` fermée : avant, rien ne les
   ordonnait dans ce job).
3. **Doublons restants, à trancher (gain de temps, aucune perte)** : `pnpm test` du job `qualite`
   rejoue les unitaires déjà exécutés par `e2e` et `front` ; `pnpm test:coverage` du job `e2e`
   exécute aussi `web#test:coverage`, déjà fait par `front` (filtre possible :
   `pnpm turbo run test:coverage --filter=!@siteperso/web`, le résumé de couverture de ce job ne lit
   que l'API et les contrats).
4. **Exécuteur** : `maxWorkers` par défaut = cœurs moins un ; sur 2 cœurs (dépôt privé) un seul
   processus, durée de la passe fusionnée comparable à la série d'avant (197 s simulés) ; sur 4
   cœurs, 3 processus (68 s simulés). Délais du job inchangés (15 min).
5. **L14-08 et L14-10 dans `pnpm check`** : insérer actionlint et shellcheck à côté de
   `pnpm format:check` (avant `db:test:up`), ordre : garde-fous, formatage et analyse statique, puis
   conteneurs et Turborepo. `.husky/pre-commit` n'a pas de ligne shebang (convention husky 9, lancé
   par `sh -e`) : shellcheck a besoin de `--shell=sh` ou d'une directive `# shellcheck shell=sh`.

## Décisions

- **`maxWorkers` par défaut** plutôt qu'une borne (voir L14-15) ; alternative écartée : borne propre
  au projet e2e (groupe séparé imposé par Vitest), borne globale en pourcentage.
- **Une seule invocation de Turborepo avec `@siteperso/web#test:e2e`** plutôt que deux
  (`lint typecheck` puis `test:coverage` et les parcours) : les tâches indépendantes se recouvrent,
  le chemin critique est le front. Alternative écartée : garder deux invocations (le lint du front,
  113 s, s'ajouterait à la couverture au lieu de la recouvrir).
- **`web#test:e2e` après `test:coverage`** plutôt qu'après `test` : sinon `web#test` revient dans le
  graphe de `pnpm check` et du job CI front. Effet de bord accepté : `pnpm test:e2e` (racine) exécute
  la couverture du front avant les parcours au lieu des seuls tests.
- **Script Node sur l'API de Prettier, contenu de l'index**, plutôt que `lint-staged` (paquet de plus,
  remise de côté des modifications non indexées pendant le hook) ou que `prettier --check` sur la
  liste des fichiers (jugerait l'arbre de travail, faux pour un fichier indexé en partie).
- **Tests du script dans `.husky/tests/`**, lancés par `pnpm husky:test` dans `pnpm check`, plutôt
  que dans `.claude/hooks/tests/` (périmètre de la branche `lot-14-hooks`).

## Non fait

- Côté orchestrateur de L14-16 (pas de nouveau `pnpm check` avant le push quand l'arbre fusionné est
  celui que la recette a vérifié) : hors de ce rôle.
- `.github/workflows/ci.yml` : étape c (dev-devops), changements décrits ci-dessus.

## Points ouverts

1. **Chemin critique du front** : `web#test:e2e` attend `web#lint` (113 s mesurés, ESLint typé qui
   lit `.nuxt` par le `tsconfig`). Une génération dans un `buildDir` séparé (alternative écartée en
   F1 bis) permettrait de lancer les parcours dès la fin de `web#test:coverage` : environ 55 s de
   moins sur `pnpm check` d'après le résumé Turborepo. Touche `nuxt.config.ts` ou le script
   `test:e2e` du front, hors des tickets de ce lot : à décider (lot F11 d'optimisation ?).
2. **Borne ponctuelle des processus sous Turborepo** : en mode d'environnement strict (défaut de
   Turborepo 2, « only those that are specified in the `env` and `globalEnv` keys »),
   `VITEST_MAX_WORKERS` n'atteint pas les tâches de `pnpm check` ; sur une machine où il saturerait,
   la seule borne est `pnpm --filter @siteperso/api exec vitest run --coverage --maxWorkers=<n>`.
   Ajouter la variable à `env` de `test:coverage` dans `turbo.json` si le besoin apparaît (non vérifié
   par une exécution : déduit de la documentation).
3. **Turborepo 2.11.13** est publié (2.11.12 épinglé) : hors ticket, non changé.
4. Mesures sur une machine partagée (autres sessions et worktrees actifs) : jusqu'à 40 % d'écart
   entre deux runs identiques des e2e seuls ; pour `pnpm check`, la comparaison reste nette :
   330 et 337 s avant, 211, 211 et 212 s après (251 s avec un autre `pnpm check` en parallèle).
