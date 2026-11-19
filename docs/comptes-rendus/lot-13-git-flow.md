# Lot 13 : git flow (lead-architecte)

Branche `lot/13-git-flow` depuis `develop` (`16abe55`), 19 novembre 2026, ticket GITFLOW, autorisation
nominative « config » `f86ab397`. Décision de Julien du jour : le dépôt adopte git flow ; `develop`
remplace `v3/backend` comme branche d'intégration permanente ; la session principale peut pousser
`develop`, et uniquement `develop` ; fusion dans `main`, étiquettes, push de `main` et déploiement
réservés à Julien. Rien n'a été poussé.

## Fait

| Commit    | Sujet                                                                              |
| --------- | ---------------------------------------------------------------------------------- |
| `f31b909` | feat(hooks): git push permis à la seule session principale, vers origin develop    |
| `0900822` | chore(claude): refus de push en préfixe à la place du refus de tout git push       |
| `1d0866d` | ci: base par défaut du script d'intégrité origin/develop, sinon develop            |
| `69dcca2` | test(ci): dépôts temporaires des tests d'intégrité sur une branche develop         |
| `abebaa6` | ci: déclencheurs git flow et base d'intégrité develop                              |
| `88a89ee` | feat(deploy): la production se déploie depuis main, jamais depuis develop          |
| `34e88c4` | docs: git flow dans CLAUDE.md et docs/03 (develop, push de la session principale)  |
| `0a1162b` | docs(backlog): lot 13 git flow, suites de la recette du lot 12 en lot 14           |

Les commits qui touchent une configuration protégée ou un test existant (`f31b909`, `0900822`,
`1d0866d`, `69dcca2`, `abebaa6`) portent `Justification-test: GITFLOW <raison>`.

### 1. Règle de push dans les hooks (`.claude/hooks/lib/shell.mjs`, `guard.mjs`, `policy.mjs`)

`analyzeCommand(command, cwd, role)` reçoit désormais le rôle (`guard.mjs` passe `ctx.role`, déterminé
comme avant : `agent_type` absent ou vide = `main`). Le `case 'push'` appelle `pushRefusal`, qui
renvoie le motif du refus ou `null`. Seule forme permise, et seulement pour `main` :

```
git [-C <chemin>] [-c <clé>=<valeur>] push [-u | --set-upstream] origin develop[:develop]
```

Refusés, avec un message qui dit pourquoi :

- tout push d'un agent : « git push est interdit aux agents (rôle dev-api) : seule la session
  principale pousse, et uniquement develop vers origin » ;
- autre remote qu'`origin` (nom ou URL) ;
- autre refspec : `main`, `master`, `refs/heads/main`, `develop:main`, `HEAD`, `HEAD:…`, `+…`
  (forcée), `:…` (suppression), `lot/*`, `release/*`, `refs/tags/…`, `tag <nom>`, tout autre nom ;
  plusieurs refspecs ;
- refspec absente : `git push`, `git -C . push`, `git push origin`, `git push -u origin` (le résultat
  dépend de `push.default` et de la branche suivie) ;
- options : `--force`, `--force-with-lease[=…]`, `--force-if-includes`, `-f` et options courtes
  groupées (`-uf`), `--delete`, `-d`, `--prune`, `--all`, `--branches`, `--mirror`, `--tags`,
  `--follow-tags`, `--push-option`, `-o`, `--no-verify`, `--repo`, `--receive-pack`, `--exec`, `--`,
  et toute autre option (`--dry-run` compris) ;
- ce qui change la destination autour du push : `--git-dir`, `--work-tree`, `--namespace`,
  `--config-env`, `-c remote.*`, `-c url.*`, `-c push.*`, `-c branch.*`, `-c alias.*`, toute variable
  `GIT_*` en tête de commande (`GIT_DIR=…`, `env GIT_CONFIG_COUNT=…`) ;
- un push caché : alias qui lance push (`git -c alias.p=push p …`, `git config alias.p push`) et
  `git … push` dans du code opaque (`bash -c`, `sh -c`, `python3 -c`, `xargs git push …`, script
  exécuté, here-document), hors scripts des garde-fous eux-mêmes (`.claude/hooks/`, dont les tests
  citent git push sans le lancer).

Corrections connexes du parseur : `--config-env` et `--attr-source` sont des options globales à valeur
(avant, `git --config-env a=b push origin main` faisait lire `a=b` comme sous-commande et le push
passait inaperçu). Le rappel injecté au démarrage des sous-agents dit « Aucun git push ».
`.claude/hooks/README.md` : section « git push ».

### 2. `.claude/settings.json`

`Bash(git push *)` (qui refusait tout push avant même les hooks, donc aussi le push de `develop`) est
remplacé par 27 refus en motif : `--force*`, `-f*`, `--delete*`, `-d*`, `--prune*`, `--all*`,
`--mirror*`, `--tags*`, `--follow-tags*`, `--push-option*` (chacun en tête, `git push X*`, et après
d'autres mots, `git push * X*`), `-o *`, `* main*`, `*:main*`, `*+*`, `* tag *`, `*refs/tags/*`.
Grammaire vérifiée dans la documentation Claude Code (https://code.claude.com/docs/en/permissions,
« Wildcard patterns ») : `*` en toute position, l'espace avant `*` fait partie du motif, un motif ne
voit pas `git -C . push` ni `sh -c '…'`. L'autorité reste le hook.

### 3. Tests des hooks

Nouveau fichier `.claude/hooks/tests/git-push.test.mjs` (69 cas, entrée JSON sur stdin de
`guard.mjs pre-tool-use`, comme `run.sh`) : les trois formes et `develop:develop` acceptées pour
`main`, ainsi que `git -C <worktree> push origin develop`, `git -C . push -u origin develop`,
`git -c color.ui=never push origin develop` et `cd <dépôt> && git push origin develop` ; chaque forme
permise refusée aux rôles `dev-api`, `lead-architecte`, `correcteur`, `chef-de-projet` avec le motif
« interdit aux agents » et le nom du rôle ; 61 variantes dangereuses refusées pour `main`, chacune avec
son motif attendu, puis toutes refusées aussi pour `dev-api` ; les lectures (`git log --grep push`,
`grep -rn "git push" docs`, `git config --get alias.push`) restent permises. `pnpm hooks:test` :
115 tests, 115 verts (46 avant le lot).

### 4. Script d'intégrité

`scripts/ci/check-tests-integrity.sh` : base par défaut `origin/develop`, sinon `develop` ; en-tête et
message « base introuvable » à jour. Nouveau `scripts/ci/tests/default-base.test.sh` (3 cas : base
`develop` locale, `origin/develop` prioritaire, code 2 sans `develop`). Le script `integrity` du
`package.json` racine ne cite aucune branche (`bash scripts/ci/check-tests-integrity.sh`) : rien à
changer ; la documentation de `pnpm integrity [base]` dans `CLAUDE.md` est corrigée.

### 5. CI

`.github/workflows/ci.yml` : `push` limité à `develop`, `main`, `release/**`, `hotfix/**`, `lot/**`,
`pull_request` inchangé ; `BASE_REF` par défaut `develop`. SHA des actions intacts.

### 6. Documentation, agents et déploiement

- `CLAUDE.md` : « Flux git et interdictions » réécrit (git flow, push de la session principale, ce
  qui est réservé à Julien, jamais de push forcé) ; ligne de l'orchestrateur dans « Agents et
  garde-fous » ; défaut de `pnpm integrity`.
- `docs/03-organisation-agents.md` : règle commune sur le push et section « Flux Git ».
- `docs/02-stack-technique.md` : ne cite aucune branche, inchangé.
- `docs/backlog.md` : nouvelle section « 7 quinquies. Lot 13 — Git flow » (L13-01 à L13-06,
  réglages GitHub) ; l'ancienne section devient « 7 sexies. Lot 14 — Suites de la recette du
  lot 12 », tickets renumérotés L14-01 à L14-04 ; règles transverses, critères D5 et D10 et sections
  des lots 0 à 6 sur `develop`.
- `.claude/agents/*.md` : aucun ne cite l'ancienne branche ni le push (`grep -n "v3/backend\|push"
  .claude/agents/*.md` vide) ; inchangés. Leur interdiction de push vient de `CLAUDE.md` et du hook.
- **Déploiement** : `scripts/deploy/update.sh` faisait `git pull --ff-only` sur la branche courante du
  dépôt du VPS, quelle qu'elle soit (un clone resté sur `develop` aurait déployé `develop`). Il tire
  désormais `origin main` ; `first-install.sh` et `update.sh` refusent (code 1) un dépôt qui n'est pas
  sur `main` (`require_deploy_branch`, `DEPLOY_BRANCH=main` dans `common.sh`, non surchargeable) ; en
  `DRY_RUN=1`, ils avertissent seulement (le test e2e `deploy-scripts` lance `update.sh` en dry-run
  depuis une branche de travail). `docs/deploiement.md` : clone sur `main`, section « Branche
  déployée ».

## Vérifications

| Critère                                    | Commande et résultat                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Tests des hooks                            | `pnpm hooks:test` : 115 tests, 115 verts, 0 échec                                                            |
| Tests du script d'intégrité                | `pnpm integrity:test` : 19, 3 et 8 réussis, 0 échec                                                          |
| Intégrité depuis develop                   | `pnpm integrity develop` puis `pnpm integrity` (défaut) : « HEAD comparé à develop (16abe55734e7) », OK      |
| `pnpm check`, passe 1                      | vert : 391 unitaires API, 133 contrats, 552 e2e, couverture 100 % (lignes, branches, fonctions, instructions) |
| `docker compose down -v` puis passe 2      | vert, mêmes nombres ; e2e et couverture rejoués hors cache (dont `deploy-scripts.e2e-spec.ts`, 8 tests)       |
| Résidu de l'ancienne branche               | `grep -rn "v3/backend" . \| grep -Ev "^(\./)?docs/(comptes-rendus/\|revues/\|lots\.md)"` : voir « Non fait »  |
| Formatage                                  | `pnpm format` : aucun changement                                                                             |

### Démonstration des cas de hooks

Le hook refuse à un sous-agent de lancer lui-même les scripts de `.claude/hooks/` (« les scripts des
garde-fous ne se lancent que depuis la session principale ») : je n'ai donc pas appelé `run.sh`. Les
tests de `git-push.test.mjs` font exactement ce qu'il fait (`node guard.mjs pre-tool-use`, entrée JSON
sur stdin, `CLAUDE_PROJECT_DIR` au dépôt temporaire) et vérifient code de sortie et motif :

```
▶ git push : formes permises à la session principale
  ✔ accepte les trois formes et la refspec develop:develop
▶ git push : refusé aux agents
  ✔ refuse chaque forme permise au rôle dev-api
  ✔ refuse chaque forme permise au rôle lead-architecte
▶ git push : variantes refusées à la session principale
  ✔ refuse git push --force origin develop
```

Pour rejouer à la main depuis la session principale (rien n'est poussé, le hook ne fait qu'analyser) :

```sh
w=$PWD   # racine du worktree
printf '%s' "{\"session_id\":\"demo\",\"cwd\":\"$w\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git push origin develop\"}}" \
  | sh .claude/hooks/run.sh pre-tool-use; echo "code $?"        # code 0
printf '%s' "{\"session_id\":\"demo\",\"agent_type\":\"dev-api\",\"agent_id\":\"x\",\"cwd\":\"$w\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git push origin develop\"}}" \
  | sh .claude/hooks/run.sh pre-tool-use; echo "code $?"        # code 2, « git push est interdit aux agents (rôle dev-api) … »
printf '%s' "{\"session_id\":\"demo\",\"cwd\":\"$w\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git push --force origin develop\"}}" \
  | sh .claude/hooks/run.sh pre-tool-use; echo "code $?"        # code 2, « push forcé (--force) interdit à tous : il réécrit l'historique distant »
```

### Simulation des refus de `permissions.deny`

Script de lecture seule (scratchpad) qui traduit chaque motif `Bash(…)` en expression régulière
(`*` = toute suite, « espace * » final admet la commande nue) :

```
permis  "git push origin develop" ok
permis  "git push -u origin develop" ok
permis  "git push --set-upstream origin develop" ok
permis  "git push origin develop:develop" ok
danger  "git push --force origin develop" refusé (git push --force*)
danger  "git push origin develop --force-with-lease" refusé (git push * --force*)
danger  "git push -d origin x" refusé (git push -d*)
danger  "git push origin main" refusé (git push * main*)
danger  "git push origin HEAD:main" refusé (git push *:main*)
danger  "git push origin +develop" refusé (git push *+*)
danger  "git push origin tag v1" refusé (git push * tag *)
… 17 variantes dangereuses, toutes refusées ; JSON valide, 34 règles deny
```

### Déploiement (clone jetable du lot dans le scratchpad)

```
== sur develop, exécution réelle
[deploy] ERREUR : dépôt sur « develop » : la production se déploie depuis main uniquement (git -C …/clone switch main)
code 1
== sur develop, DRY_RUN=1
[deploy] (dry-run) dépôt sur « develop », pas sur main : une vraie exécution s'arrêterait ici
[deploy] Mise à jour du code depuis origin/main (fast-forward uniquement)
[deploy] (dry-run) git -C …/clone pull --ff-only origin main
== sur main, DRY_RUN=1
[deploy] Mise à jour du code depuis origin/main (fast-forward uniquement)
[deploy] (dry-run) git -C …/clone pull --ff-only origin main
```

## Non fait

- `docs/lots.md` : laissé à l'orchestrateur (fusion), comme demandé.
- `docs/compte-rendu-2026-11-18.md` cite encore `v3/backend` (lignes 3 et 150) : c'est le compte rendu
  daté de la recette du 18 novembre (branche et HEAD `4879eb7` de ce jour-là), historique au même titre
  que `docs/comptes-rendus/` ; je ne l'ai pas réécrit. C'est le seul résultat de
  `grep -rn "v3/backend" . | grep -Ev "^(\./)?docs/(comptes-rendus/|revues/|lots\.md)"`. À l'orchestrateur
  de dire s'il faut l'ajouter à la liste des historiques ou le retoucher.
- Pas de test e2e pour le refus de branche des scripts de déploiement (les tests Vitest étaient hors
  de mon périmètre) : démonstration manuelle ci-dessus ; à confier à dev-devops ou à la qa.

## Décisions

- **Test existant « refuse git push, --no-verify, core.hooksPath et HUSKY=0 pour tous » non modifié.**
  Ses deux commandes de push (`git push origin HEAD`, `git -C . push`) restent refusées pour `main` et
  pour `lead-architecte` sous la nouvelle règle (refspec `HEAD`, refspec absente) : le test est
  toujours juste, le modifier aurait été inutile. La nouvelle règle est couverte par le nouveau
  fichier. Alternative écartée : réécrire ce test (modification d'un oracle sans nécessité).
- **Renommage de la branche des dépôts temporaires dans quatre fichiers de tests** (`69dcca2`,
  Justification-test GITFLOW) : `check-tests-integrity.test.sh`, `stryker-disable.test.sh`,
  `stryker-disable.test.mjs`, `stryker-oracles.test.mjs` passent la base en argument explicite et
  restaient justes ; seul le nom de branche change (12 lignes), pour le critère « grep vide ». Aucune
  assertion, aucun scénario touché. Commit isolé : l'orchestrateur peut l'écarter s'il préfère.
- **Forme stricte** : `--` et `--dry-run` sont refusés même s'ils seraient inoffensifs ; la règle est
  « exactement ces formes ». `-u` est accepté à toute position (git le permute).
- **`-c` admis sauf clés de destination** (`remote.`, `url.`, `push.`, `branch.`, `alias.`) : un
  `-c remote.origin.pushurl=…` enverrait `develop` ailleurs qu'`origin`. Toute variable `GIT_*` en
  tête est refusée (plus simple et plus sûr que de lister `GIT_DIR`, `GIT_CONFIG_*`, `GIT_NAMESPACE`).
- **git push dans du code opaque** refusé à tous, `main` compris : sans cela, retirer
  `Bash(git push *)` ne laissait que le hook, et `bash -c 'git push origin main'` lui échappait (trou
  déjà présent avant le lot pour les deux couches). Exception : les scripts de `.claude/hooks/`, que
  seule la session principale lance et dont les tests citent git push.
- **Déploiement depuis `main` seulement**, pas d'étiquette : un dépôt en HEAD détachée (étiquette) est
  refusé. Alternative écartée : un `DEPLOY_REF` surchargeable, qui permettrait de déployer `develop`
  par erreur. Le déploiement par étiquette est un point ouvert pour Julien.

## Points ouverts

- **Effet de `.claude/settings.json`** : ce lot assouplit les permissions (le refus de tout `git push`
  disparaît, seules les variantes dangereuses restent refusées en motif) ; il ne prend effet qu'à la
  fusion dans `develop` et au rechargement des réglages de la session principale. À valider par
  Julien à la fusion. Les motifs ont été simulés (voir Vérifications), pas exécutés contre Claude Code :
  aucun push n'a été tenté.
- **Faux positifs des garde-fous rencontrés** : un `node -e` en lecture seule de `.claude/settings.json`
  a été refusé, la flèche `=>` étant lue comme une redirection (`WRITE_PRIMITIVES`) ; j'ai mis le même
  contrôle, en lecture seule, dans un script du scratchpad avec le chemin en argument. Un fichier de
  test neuf ne peut pas citer les chemins d'état des hooks (refus « vise l'état des garde-fous ») : le
  nouveau test n'en a pas besoin et ne les cite pas.
- **Alias git préexistants** de la configuration de l'hôte (`git p` = `push`) : invisibles pour le
  hook, consigné dans les limites du README.
- **CI tant que `origin/develop` n'existe pas** : le job garde-fous d'un push sur `lot/**` ou `develop`
  compare à `origin/develop` ; il échouera (code 2, base introuvable) jusqu'au premier push de
  `develop` par la session principale.
- **Déploiement par étiquette** (`v1.2.0` en HEAD détachée) : refusé aujourd'hui ; à décider par Julien
  s'il le veut, avec une règle (étiquette atteignable depuis `main`).

## Réglages GitHub à faire par Julien

- Branche par défaut : `develop` (les pull requests de Dependabot et les nouvelles PR viseront
  `develop`).
- Protection de `main` : fusion par pull request seulement, relecture exigée, pas de push direct, pas
  de push forcé, pas de suppression ; statuts de la CI exigés si souhaité.
- Protection de `develop` conseillée : pas de push forcé, pas de suppression.
- Suppression de `origin/v3/backend` (encore présente sur GitHub ; les agents ne suppriment pas de
  branche distante).
- Facultatif : protection des étiquettes `v*` (création réservée à Julien).
