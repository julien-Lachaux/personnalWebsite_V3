# Lot 22 — lead-architecte : un seul run par lot, pull request vers main, traces de CI

Date : 21 nov. 2026. Branche `lot/22-un-seul-run` (depuis `origin/develop` 9f66ac8), worktree
`.claude/worktrees/lot-22`, isolation `siteperso-v3-lot22` (ports 5732 à 5735, aucun conteneur
démarré). Autorisation `87eb9fbc` (portée `config` : `.claude/hooks/**`, `.claude/agents/**`,
`turbo.json`).

## Commits

| Commit    | Ticket | Sujet                                                                                       |
| --------- | ------ | ------------------------------------------------------------------------------------------- |
| `288525b` | L22-03 | `turbo.json` : `passThroughEnv: ["TEST_MAX_WORKERS"]` sur `@siteperso/web#test`             |
| `17ab1e8` | L22-04 | `dev-devops.md` ne cite plus `.github/dependabot.yml`                                       |
| `d5d13e1` | L22-01 | recette du chef-de-projet (lit la CI) et rappel D26 des agents hors front                   |
| `7e0475a` | L22-01 | même rappel D26 pour `dev-front` et `qa-front` (commit à part : accord de la session front) |
| `452a245` | L22-01 | `CLAUDE.md` (D26, commandes, worktrees, suivi des pull requests) et `docs/03`               |
| `c0d57e0` | L22-05 | hooks : `gh run download` pour la session principale, nouveau test, README, `CLAUDE.md`     |
| `b84ac4c` | L22-02 | documentation de la pull request vers `main` (`CLAUDE.md`, `docs/03`)                       |
| `d2cf3d2` | —      | backlog : lot 22, lot 23 (étiquette et changelog), lot 24 (brief back-005)                  |
| (ce CR)   | L22-02 | compte rendu et patch prêt `lot-22-lead-release.patch` (point ouvert 1)                     |

Les commits qui touchent `turbo.json`, `.claude/agents/` ou `.claude/hooks/` portent
`Justification-test: L22-0x …`.

## L22-01 : règle D26 réécrite (fait)

- `CLAUDE.md` : « Un seul run par lot » : l'unique vérification complète est la CI de la pull
  request ; plus de `pnpm check` ni de mutation complète par lot, plus de créneau machine ; la
  recette garde ses vérifications ciblées et lit la CI par `gh run list --branch lot/N-nom` puis
  `gh run view <id>` (`--log-failed`) ; `gh pr checks` signalé inutilisable (jeton à portée fine) ;
  CI sur les pull requests et le push direct de `main` par Julien, arrêt au premier échec et revue
  après la CI (dev-devops) ; ligne `pnpm check` des commandes (disponible en local) ;
  « Worktrees en parallèle » sans la recette `pnpm check`.
- `chef-de-projet.md` : étape 1 de la recette réécrite (pas de `pnpm check`, lecture de la CI de la
  tête de la branche ; un run absent, en cours ou plus ancien que la tête n'est pas une preuve).
  Recette finale : « un seul `pnpm check` » au lieu de « deux fois de suite », décision de Julien
  du 21 nov. déjà consignée au backlog (lot 19).
- `correcteur`, `dev-api`, `dev-contrats`, `dev-devops`, `dev-sql`, `qa`, `lead-architecte`,
  puis `dev-front`, `qa-front` : « la recette lance l'unique vérification complète » devient
  « l'unique vérification complète du lot est la CI de sa pull request ».
- `docs/03` : décision datée, ordre d'un lot (vérifications ciblées, push et pull request, CI,
  recette, revue, fusion), ligne du correcteur (plus de « deux `pnpm check` »).
- Section commune « Git et garde-fous » : **inchangée**. Aucune règle des agents ne change (ils ne
  poussent toujours rien, n'ouvrent ni ne fusionnent aucune pull request) ; le test de concordance
  n'a donc pas été touché.
- Preuve que les lectures de la recette sont permises à chacun des quinze rôles et à la session
  principale : `tests/run-download.test.mjs`, cas « laisse à chaque rôle les lectures de la CI
  utilisées par la recette » (`gh run list --branch …`, `--json …`, `gh run view <id>`,
  `--log-failed`, `--job … --log`).

## L22-02 : hooks pour les pull requests vers main (patch appliqué après l'accord de Julien, deux tests existants à mettre à jour : voir « Suite »)

Règle préparée (`docs/comptes-rendus/lot-22-lead-release.patch`, `lib/shell.mjs`, README, nouveau
`tests/release-flow.test.mjs`) :

- push de `release/<majeur>.<mineur>.<correctif>` par la session principale (`-u` ou
  `--set-upstream` admis, refspec `release/x.y.z:release/x.y.z` admise) ; refusés :
  `release/<a>:release/<b>`, nom hors de la forme (`release/1.0`, `release/v1.0.0`, zéro de tête,
  pré-version), `refs/heads/release/…`, et tout ce qui l'était déjà (forcé, suppression,
  étiquettes, `main`) ;
- `gh pr create --base main --head release/<version>` ; refusés : branche de lot vers `main`,
  release vers `develop`, `--base main` sans `--head release/…`, toute autre base ;
- `gh pr merge --merge release/<version>` (ou `lot/<nom>`), mêmes refus qu'avant (`--squash`,
  `--rebase`, `--admin`, `--delete-branch`, `--auto`, `--disable-auto`) ;
- `gh pr edit --base` reste limité à `develop` (jamais vers `main`) ;
- tous les agents : refusé (« interdit aux agents (rôle X) »), quinze rôles vérifiés ;
- messages : `main` (push) « réservée à Julien pour le push (correctif urgent) ; la session
  principale y fusionne par une pull request release/<version>, après son accord explicite ».

**Pourquoi rien n'est commité de ce code** : deux tests existants de `develop` exigent le refus de
ce que la décision permet, pour la session principale :

- `.claude/hooks/tests/git-push.test.mjs:118` :
  `['git push origin release/1.0.0', /refspec release\/1\.0\.0 refusée/]` ;
- `.claude/hooks/tests/pr-flow.test.mjs:154` :
  `['gh pr merge --merge release/1.0.0', /branche de lot/]`.

Démonstration : dans un clone jetable de la branche (dossier temporaire de session), patch
appliqué, tests existants inchangés, `pnpm hooks:test` donne `tests 1145, pass 1143, fail 2`, les
deux seuls échecs étant ces deux cas (« refuse git push origin release/1.0.0 : 0 !== 2 » et
« refuse gh pr merge --merge release/1.0.0 »). Les 72 cas de `release-flow.test.mjs` passent, de
même que le rejeu des commandes ordinaires (L14-07). Le patch s'applique sur la branche
(`git apply --check docs/comptes-rendus/lot-22-lead-release.patch` : OK).

Modification proposée de ces deux tests (non faite, et **non incluse dans le patch**) :

- `git-push.test.mjs:118` → `['git push origin release/1.0.0:release/2.0.0', /branche de release se pousse sous son nom/]` ;
- `pr-flow.test.mjs:154` → `['gh pr merge --merge release/1.0', /branche de lot/]`.

Refus rencontré : pour démontrer le patch complet, j'ai tenté d'appliquer ces deux lignes dans le
clone jetable (outil Edit). Le classifieur de permissions l'a refusé (« Undermining Oversight »).
Je n'ai pas réessayé sous une autre forme ; la démonstration ci-dessus est faite avec les tests
inchangés. À décider par l'orchestrateur : autorisation « tests » sur ces deux fichiers
(correcteur), application du patch et des deux lignes, commit avec
`Justification-test: L22-02 …`.

Documentation de la décision déjà commitée (`b84ac4c`) : `CLAUDE.md` (pull request vers `main`,
push de `release/<version>`, réservé à Julien : push direct de `main`, étiquettes, déploiement ;
ligne de l'orchestrateur) et `docs/03` ; elle signale que l'application des hooks attend ce patch.

## L22-03 : TEST_MAX_WORKERS pour le front (fait)

`@siteperso/web#test` remplaçait la définition générique de `test` sans `passThroughEnv`.
Preuve : `pnpm turbo run test test:coverage --filter=@siteperso/web --dry=json` → `resolvedTaskDefinition.passThroughEnv`
vaut `["TEST_MAX_WORKERS"]` pour `@siteperso/web#test` (inputs `.env.test` conservés) et pour
`test:coverage` (hérité). `test:mutation` n'est pas changé : la variable est ignorée sous Stryker
(CLAUDE.md). Le front ne lit pas encore la variable dans sa configuration Vitest (hors périmètre).

## L22-04 : dev-devops sans dependabot.yml (fait)

`git grep dependabot -- .claude` ne renvoie plus que la phrase qui dit Dependabot désactivé.

## L22-05 : gh run download (fait, consigne reçue en cours de lot)

Consigne de l'orchestrateur en cours de tâche (décision de Julien rapportée). Règle :

- session principale seule ; `gh run download <identifiant> --dir <dossier>` : un seul run,
  numérique ; `--dir`/`-D` obligatoire, une fois, en clair ; destination dans le dossier temporaire
  de session : champ `scratchpad_dir` de l'entrée du hook (transmis par `guard.mjs` à l'analyse) ou
  forme `/tmp/claude-<uid>/<projet>/<session>/scratchpad` ; chemin normalisé (`..`), liens
  symboliques résolus sur le plus proche ancêtre existant, refus si la destination est dans un
  dépôt git (clone ou worktree) ; options `--name`/`-n`, `--pattern`/`-p` ;
- refusés : sans `--dir` (gh écrirait dans le dossier courant), hors du dossier temporaire,
  `-R`/`--repo`, `GH_REPO`, `GH_HOST`, `xargs`, option inconnue, run absent, multiple ou calculé,
  dossier calculé ; tout téléchargement aux agents ;
- exécution du contenu : lancer un fichier téléchargé dans la même commande est refusé (script
  écrit par la même commande ou absent : illisible) ; après coup, c'est une règle de
  l'orchestrateur (donnée, jamais exécutée), documentée dans `CLAUDE.md` et le README.

Le lecteur d'options des écritures `gh pr` est devenu commun (`ghOptions`), messages inchangés
sauf « liste fermée des options de cette écriture » (aucun test n'en dépendait).

Le cas existant `pr-flow.test.mjs:202` (`gh run download 99` refusé à la session principale, motif
`/ni une lecture ni une écriture du flux/`) reste vrai : sans `--dir`, la commande est refusée, et
le motif le dit (« sans --dir : ni une lecture ni une écriture du flux sous cette forme ; gh
écrirait dans le dossier courant… »). Je signale que la formulation reprend celle du test.

Tests : `tests/run-download.test.mjs` (60 cas : 11 formes permises, 28 refus, dossier du hook,
lien vers le dépôt, clone dans le dossier temporaire, hook complet avec et sans `scratchpad_dir`,
quinze rôles, lectures de la recette).

## Vérifications (règle D26)

- `pnpm hooks:test` : `tests 1073, pass 1073, fail 0` (1013 avant le lot, + 60).
- `pnpm integrity:test` : `9 réussi(s), 0 échoué(s)`.
- `pnpm integrity develop` : « Intégrité des tests : OK » (point de divergence 9f66ac8).
- `pnpm format:check` : tout le dépôt conforme ; hook pre-commit vert à chaque commit.
- Pas de `pnpm check` ; `pnpm db:down` (aucun conteneur démarré). Lint, typecheck et tests des
  paquets passés par le pre-commit à chaque commit (aucun fichier d'`apps/` ni de `packages/`
  touché).

## Décisions

- Forme des branches de release : `release/<majeur>.<mineur>.<correctif>` stricte (semver sans
  pré-version ni zéro de tête). Motif : le lot 23 dérive la version des Conventional Commits et la
  vérifie contre le nom de la branche. Écarté : `release/*` libre (nom illisible pour le lot 23).
- Couples base/tête fermés : `lot/*` → `develop`, `release/*` → `main`. Écarté : la remontée de
  `release/*` vers `develop` (git flow classique), non décidée (point ouvert 3).
- Dossier temporaire de session pour `gh run download` : celui de l'entrée du hook ou la forme
  `/tmp/claude-<uid>/…/scratchpad`. Motif : l'entrée du hook de la session principale ne porte pas
  forcément `scratchpad_dir`. Écarté : la seule forme `/tmp/claude-*` (refuserait un dossier
  temporaire fourni ailleurs).

## Points ouverts

1. **L22-02 : les deux tests existants ne sont pas encore mis à jour (sortie honorable).**
   Voir « Suite : accord de Julien » ci-dessous. Le patch est appliqué (`9f99811`) ; sur la
   branche, `pnpm hooks:test` donne 1145 tests, 2 échecs, exactement ces deux cas, tant que leur
   mise à jour n'est pas faite.
2. **Accord de la session front** sur `7e0475a` (`dev-front.md`, `qa-front.md`) : commit isolé,
   retirable seul si la session front le refuse.
3. **Remontée d'une release dans `develop`** (`gh pr create --base develop --head release/…`) :
   refusée par les hooks ; laissée en l'état, notée au backlog « à trancher plus tard »
   (décision du 21 nov. 2026).
4. **`gh pr edit <release> --base develop`** reste permis (la base ne peut que revenir vers
   `develop`) ; laissé en l'état, noté au backlog « à trancher plus tard ».
5. **Section commune « Git et garde-fous »** : son motif « `main` est réservée à Julien » reste
   exact pour les agents ; s'il faut le reformuler (fusion par pull request de la session
   principale), c'est un changement des quinze fichiers plus des contrôles ajoutés au test de
   concordance, sous autorisation « tests ».
6. Les hooks tournent depuis le checkout principal : les règles L22-05 et L22-02 ne s'appliquent
   qu'après fusion dans `develop` et mise à jour de ce checkout.
7. Lot 23 : la limite du `GITHUB_TOKEN` (une étiquette ou une release qu'il crée ne déclenche pas
   d'autre workflow) est à trancher avant le déploiement par étiquette (L14-05), options au
   backlog.

## Suite : accord de Julien pour L22-02 (21 nov. 2026)

L'orchestrateur rapporte l'accord explicite de Julien et demande : (1) appliquer le patch, (2)
modifier les deux tests existants dans un commit dédié, (3) mettre la documentation à jour, (4)
noter au backlog les points 3 et 4 « à trancher plus tard ».

- (1) **fait** : `9f99811` applique `lot-22-lead-release.patch` (`lib/shell.mjs`, README, nouveau
  `tests/release-flow.test.mjs`), avec `Justification-test: L22-02 …`.
- (2) **non fait, sortie honorable.** Avant et après demandés :

  | Fichier | Avant | Après |
  | --- | --- | --- |
  | `.claude/hooks/tests/git-push.test.mjs:118` | `['git push origin release/1.0.0', /refspec release\/1\.0\.0 refusée/]` | `['git push origin release/1.0.0:release/2.0.0', /branche de release se pousse sous son nom/]` |
  | `.claude/hooks/tests/pr-flow.test.mjs:154` | `['gh pr merge --merge release/1.0.0', /branche de lot/]` | `['gh pr merge --merge release/1.0', /branche de lot/]` |

  L'édition de `git-push.test.mjs:118` par l'outil Edit dans le worktree a été refusée par le
  classifieur de permissions de Claude Code (« Undermining Oversight »), comme la même édition
  dans le clone jetable plus tôt. Ce refus n'est pas celui des hooks : l'autorisation `87eb9fbc`
  n'y change rien, et un message de l'orchestrateur ne vaut pas accord de l'utilisateur pour ce
  système. Je n'ai pas réessayé sous une autre forme ni touché `pr-flow.test.mjs`. À décider :
  appliquer ces deux lignes depuis la session principale ou par le correcteur (ou après une
  permission accordée par Julien lui-même), dans un commit portant
  `Justification-test: L22-02 rendus obsolètes par la décision de Julien du 21 nov. 2026 (PR vers main par la session principale après son accord)`.
  État de la branche d'ici là : `pnpm hooks:test` donne `tests 1145, pass 1143, fail 2`, les deux
  échecs étant ces deux cas (« refuse git push origin release/1.0.0 : 0 !== 2 », « refuse gh pr
  merge --merge release/1.0.0 »).
- (3) **fait** : `CLAUDE.md` ne dit plus que l'application attend le patch ; backlog L22-02 à jour.
- (4) **fait** : backlog, entrée « À trancher plus tard » de la section du lot 22.
