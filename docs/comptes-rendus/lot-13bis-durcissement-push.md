# Lot 13 bis : durcissement du push et de l'analyseur des garde-fous (lead-architecte)

Branche `lot/13bis-durcissement-push` depuis `develop` (`802360b`), worktree
`.claude/worktrees/lot-13bis-durcissement`, 19 novembre 2026 (soir), ticket GITFLOW-2, autorisation
nominative « config » `48209853` (`.claude/hooks/lib/shell.mjs`, `policy.mjs`, `state.mjs`, `guard.mjs`,
`.claude/hooks/tests/**`, `.claude/hooks/README.md`, `.claude/settings.json`). Isolation Docker :
`.env` racine fourni (projet `siteperso-v3-lot13bis`, ports 5852 et 5853), non modifié. Rien n'a été
poussé. `policy.mjs` n'a pas eu besoin d'être modifié.

Les trous venaient de l'analyseur de commandes (`lib/shell.mjs`), pas du lot 13 : sa lecture découpait
la commande en segments sans comprendre les constructions composées, et tout ce qu'il ne reconnaissait
pas passait en silence.

## Fait

| Commit    | Sujet                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------- |
| `2eeb631` | fix(hooks): racine de l'état hors session sans --path-format (git 2.30)                          |
| `cc99da5` | feat(hooks): analyseur récursif, blocs composés et « illisible donc refusé »                      |
| `8c58b68` | feat(hooks): plomberie de push refusée à tous les rôles                                           |
| `0b53169` | feat(hooks): la destination d'un push ne se redéfinit pas                                         |
| `1263fc6` | feat(hooks): -c collé lu comme -c, clés et options admises avec git push                          |
| `83e2552` | feat(hooks): gh réservé à Julien pour fusionner, étiqueter, publier, supprimer                   |
| `1e3afc7` | test(hooks): rejeu des cas de la recette du lot 13                                                |
| `f0c8600` | chore(claude): refus en préfixe de la plomberie, de git remote, de gh et de la configuration git |
| `5a0e66f` | docs(hooks): README des garde-fous, git push, illisible donc refusé, limites                      |
| `56f7bb9` | docs: CLAUDE.md, « illisible donc refusé » et ce que les hooks refusent à toute session           |

Tous les commits qui touchent `.claude/` portent `Justification-test: GITFLOW-2 <raison>`. Aucun test
existant n'a été modifié : les 115 tests des hooks d'avant le lot passent sans changement à chaque
commit. Chaque trou a son fichier de test, commité avec son correctif ; chaque fichier a été lancé sur
le code de `develop` (`802360b`) pour prouver qu'il échouait avant (voir « Preuve avant/après »).

### T1 : constructions composées, et « illisible donc refusé » partout (`cc99da5`)

Le lecteur de `lib/shell.mjs` devient récursif (classe `ShellParser`). Il lit bash et zsh (l'outil Bash
tourne sous zsh sur l'hôte : `{echo hi;}`, `=git`, `for i (1 2) cmd` y sont valides, vérifié) :

- listes `;`, `&&`, `||`, `|`, `|&`, `&`, `;;`, fins de ligne ; blocs `{ … }` (y compris `{git …;}` de
  zsh) ; sous-shells ; `if`, `then`, `elif`, `else`, `fi`, `while`, `until`, `do`, `done` ; `for`,
  `select`, `foreach` (en-tête non exécuté, variable de boucle marquée inconnue) ; `case … in … esac`
  avec motifs (`(x)`, `a|b`) ; `!` ; fonctions (`function f`, `function f()`, `f()`, `f ()`, `() { … }`
  de zsh) dont le corps est analysé comme exécuté ; `coproc` (et `coproc NOM { … }`) ; `repeat` ;
- substitutions `$(…)`, accents graves, `${…}` (avec `$(…)` dedans), y compris entre guillemets doubles ;
  substitutions de processus `<(…)`, `>(…)`, `=(…)` ; here-documents non protégés (leurs substitutions
  sont analysées ; `<<'EOF'` reste littéral) ; tableaux `x=(…)` ; `((…))` et `$((…))`, où `<<` n'ouvre
  plus de here-document (avant, `echo $((1<<2))` suivi d'une ligne `git push origin main` cachait cette
  ligne dans un faux here-document) ;
- un `cd` ou une affectation faits dans un sous-shell ou une substitution n'en sortent pas
  (`(cd docs) ; rm apps/api/src/app.spec.ts` visait avant `docs/apps/…`, non protégé) ;
- variables : résolues si elles sont affectées en clair plus tôt dans la même commande (`G=git; $G
  status`), ainsi que `HOME`, `~` et `PWD` ; toute autre expansion rend le mot illisible.

Refusé parce qu'illisible, pour toutes les règles (push, oracles, marqueurs, écritures opaques) :

- syntaxe incomplète ou inconnue : guillemet, `$(`, `(`, `${`, accent grave, `case` non refermés,
  parenthèse fermante orpheline, redirection sans cible, parenthèse collée à un mot (motif étendu,
  qualificatif de glob de zsh comme `*(e:'…':)`, qui exécute du code), `$[…]` ;
- nom de commande calculé (`$CMD …`, `"$(echo git)" …`, `` `echo git` … ``, `${G} …`, `$=X` de zsh) ;
- sous-commande git calculée, ou ni connue ni alias lisible : un alias de la configuration est résolu
  par `git config --get alias.<nom>` (depuis le dossier de la commande) puis analysé ; une commande
  externe `git-<nom>` (git-lfs…) est refusée ;
- cible d'écriture calculée (`rm "$F"`, `> "$(pwd)/…"`, accents graves, expansion d'accolades
  `app.{spec.ts,ts}`) ou relative à un dossier courant calculé (`cd "$D" && rm x`, `cd -`) ;
- script exécuté calculé, absent, trop gros (plus de 512 Ko) ou écrit par la même commande
  (`echo … > /tmp/x.sh && sh /tmp/x.sh`, cas de la recette) ; code en ligne calculé (`bash -c "$CODE"`,
  `eval "$C"`) ; code lu sur un tube (`cat s.sh | bash`, `… | node`) ; here-document ou here-string
  d'interpréteur avec expansions ; variables qui font charger du code (`BASH_ENV`, `ENV`, `ZDOTDIR`,
  `LD_PRELOAD`, `PERL5OPT`, `RUBYOPT`, `NODE_OPTIONS` avec `--require`, `--import`, `--loader`) ;
  `HUSKY` affecté à `0` ou à une valeur calculée, y compris par `export HUSKY=0` avant le commit.

Le code shell exécuté plus loin est analysé comme une commande (en plus de la recherche de git push et
d'oracles dans du code opaque, qui reste) : `sh|bash|zsh -c`, `eval`, `trap`, valeur d'un `alias` du
shell, `env -S`, `watch`, `flock -c`, `su|runuser|script -c`, `npx -c`, `pnpm exec -c`, valeurs des
clés git qui sont des commandes (`-c core.pager=…`, `core.editor`, `core.sshCommand`, `credential.*`,
filtres…), `git rebase -x|--exec`, `git submodule foreach`, `git bisect run`, variables d'éditeur ou
de pager (`GIT_EDITOR`, `GIT_SSH_COMMAND`…). Enveloppes retirées en plus : `exec -a`, `nocorrect`,
`-`, `flock FICHIER cmd`, `pnpm|npm|yarn|bun exec|x|dlx`, `npx`, `pnpx`, `bunx`. sed : la commande
`w` et le drapeau `s///w` sont des cibles d'écriture ; la commande `e` et le drapeau `s///e` qui
lancent git push sont refusés. awk : le programme est un code opaque (écritures `print > "f"`,
`system(…)`). `GIT_*` affecté ou exporté plus tôt dans la commande compte pour la règle de push.

### T2 : plomberie de push (`8c58b68`)

`git send-pack` et `git http-push` sont refusés à tous les rôles, session principale comprise, motif
« plomberie de push » ; de même `git svn dcommit|set-tree` et `git p4 submit` (« publie vers un autre
dépôt »). Un exécutable `git-<commande>` appelé directement (`git-send-pack`,
`/usr/lib/git-core/git-send-pack`) est lu comme `git <commande>` ; `git-push` direct est refusé
(« écris git push »).

### T3 : la destination ne se redéfinit pas (`0b53169`)

Refusés à tous les rôles : `git remote add|rename|remove|rm|set-url` ; `git config` en écriture, quelle
que soit la portée (`--global`, `--system`, `--local`, `--file`, `-f`), sur `remote.*`, `url.*`,
`push.*`, `branch.*.remote`, `branch.*.pushRemote`, `include.*`, `includeIf.*`, par `--add`,
`--replace-all`, `--unset*`, `set`, `unset`, `--remove-section` ou `--rename-section` d'une de ces
familles, `--edit`, `-e`, `edit`, ou avec une clé calculée. Lectures permises : `--get*`, `--list`,
`-l`, `get`, `list`, clé seule. Dans `guard.mjs`, `isGitConfigFile` refuse à tous l'écriture de
`.git/config`, de tout `config` ou `config.worktree` sous un `.git/` (worktrees et sous-modules
compris), de `~/.gitconfig`, `$XDG_CONFIG_HOME/git/config` (ou `~/.config/git/config`) et
`/etc/gitconfig`, par Edit, Write, MultiEdit, NotebookEdit, par une cible shell (redirection, `sed -i`,
`tee`…) et par un code opaque qui les nomme (`GIT_CONFIG_HINT`) ; le refus passe avant l'exemption du
dossier temporaire de session.

### T4 : -c collé (`1263fc6`)

`-c<valeur>` se lit comme `-c <valeur>` et `-C<chemin>` comme `-C <chemin>` : core.hooksPath, alias qui
lance push et clés de destination sont vus sous les deux formes. git 2.30 refuse ces formes collées
(« unknown option: -cuser.name=X », vérifié) ; la règle ne dépend pas de la version de git. Avec
`git push`, la liste devient fermée : options globales `-C`, `-c`, `--no-pager`, `-P` seulement ; clés
`-c` `color.*`, `advice.*`, `user.*`, `i18n.*`, `core.quotepath` seulement. `--exec-path` rejoint les
options globales refusées.

### T5 : gh (`83e2552`)

Refusés à tous les rôles : `gh pr merge` ; `gh release create|delete|delete-asset|edit|upload` ;
`gh repo delete|edit|rename|archive|unarchive|sync` ; toute action `delete` ou `delete-asset`
(`gh issue delete`, `gh run delete`…) ; `gh alias set|import` ; `gh api` avec `-X`, `-X<méthode>`,
`--method`, `--method=` autre que GET (casse indifférente) ou avec `-f`, `-F`, `--field`,
`--raw-field`, `--input` (formes collées comprises) ; une sous-commande gh inconnue (alias ou
extension) ou calculée. Permis : `gh pr view|list|checks`, `gh run view|list|watch`, `gh api` en GET,
`gh release list|view`, `gh auth status`, `gh --version`.

### T6 : racine de l'état hors session (`2eeb631`)

`mainCheckoutOf` (`state.mjs`) lance `git rev-parse --git-common-dir` sans `--path-format=absolute`
(git 2.31) et résout le résultat relativement à la racine du dépôt (`.git` dans le checkout principal,
chemin absolu dans un worktree ; vérifié sur l'hôte, git 2.30.2) ; une sortie vide ou sur plusieurs
lignes rend la racine du dépôt. Test `state-root.test.mjs` : `mainCheckoutOf` depuis un worktree, un
sous-dossier qui n'existe pas et le principal ; `guard.mjs session-start` lancé dans un worktree sans
`CLAUDE_PROJECT_DIR` ne crée rien dans le worktree et range l'état sous le checkout principal. Les deux
échouaient sur `develop`.

### settings.json (`f0c8600`)

Ajoutés à `permissions.deny`, là où le préfixe s'exprime proprement : `Bash(git send-pack*)`,
`Bash(git http-push*)`, `Bash(git-send-pack*)`, `Bash(git-http-push*)`, `Bash(git remote set-url*)`,
`Bash(git remote add*)`, `Bash(git remote rename*)`, `Bash(git remote remove*)`,
`Bash(git remote rm*)`, `Bash(gh pr merge*)`, `Bash(gh release create*)`, `Bash(gh release delete*)`,
`Bash(gh release edit*)`, `Bash(gh release upload*)`, `Bash(gh repo delete*)`, `Bash(gh repo edit*)`,
`Bash(gh repo rename*)`, `Edit(~/.gitconfig)`, `Edit(~/.config/git/config)`, `Edit(//**/.git/config)`,
`Edit(//**/.git/config.worktree)`, `Edit(//**/.git/worktrees/*/config.worktree)`. Grammaire vérifiée
dans https://code.claude.com/docs/en/permissions (« Wildcard patterns » ; « How path patterns
match » : `~/` depuis le dossier personnel, `//` depuis la racine, `**` sur plusieurs dossiers, une
règle Edit couvre tous les outils d'édition). `git config remote.*` (options intercalées) et `gh api`
(méthode en option) ne s'expriment pas proprement en préfixe : seul le hook les juge.

### Documentation (`5a0e66f`, `56f7bb9`)

`.claude/hooks/README.md` : section « git push » réécrite, liste de ce qui est refusé à tous, nouvelle
section « Illisible donc refusé », limites mises à jour. `CLAUDE.md` (« Agents et garde-fous » et
« Flux git et interdictions ») : la convention « écrire commandes et chemins en clair » et la liste de
ce que les hooks refusent à toute session, puisque ce lot change la façon dont tous les agents écrivent
leurs commandes.

## Vérifications

| Critère                                  | Commande et résultat                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Chaque test échoue avant son correctif   | `pnpm hooks:test` dans un worktree jetable à `802360b` avec les fichiers de test finaux : 197 échecs sur 527, tous dans les nouveaux fichiers (détail ci-dessous) ; les 115 tests existants verts |
| Tests des hooks                          | `pnpm hooks:test` : 527 tests, 527 verts, 0 échec (14,3 s ; 115 avant le lot)                                 |
| Chaque commit intermédiaire              | `pnpm hooks:test` à chaque étape : verts sauf les fichiers des trous pas encore commités                     |
| Tests du script d'intégrité              | `pnpm integrity:test` : 19, 3 et 8 réussis, 0 échec                                                          |
| Intégrité depuis develop                 | `pnpm integrity develop` : « HEAD comparé à develop (point de divergence 802360b24c14) », OK                 |
| `pnpm check`, passe 1                    | voir « pnpm check » ci-dessous                                                                               |
| `docker compose down -v` puis passe 2    | voir « pnpm check » ci-dessous                                                                               |
| Formatage                                | `pnpm format` puis `pnpm format:check` : aucun écart                                                          |

### Preuve avant/après par fichier

Fichiers de test finaux lancés sur le code de `develop` (`802360b`), puis sur le code du lot :

| Fichier                     | Suite                                              | Échecs avant | Après        |
| --------------------------- | -------------------------------------------------- | ------------ | ------------ |
| `shell-compound.test.mjs`   | T1 : push enveloppé                                | 30 sur 40    | 40 sur 40 ok |
|                             | Illisible : push et git                            | 8 sur 8      | 8 ok         |
|                             | Illisible : oracles                                | 3 sur 4      | 4 ok         |
|                             | Illisible : marqueurs                              | 1 sur 1      | 1 ok         |
|                             | Illisible : écritures opaques                      | 3 sur 4      | 4 ok         |
|                             | Commandes ordinaires (non-régression)              | 0 sur 1      | 1 ok         |
| `git-plumbing.test.mjs`     | T2                                                 | 12 sur 13    | 13 ok        |
| `git-destination.test.mjs`  | T3 (git remote, git config ; fichiers de config)   | 36 sur 38    | 38 ok        |
| `git-option-c.test.mjs`     | T4 (-c collé ; clés et options admises)            | 8 sur 10     | 10 ok        |
| `gh.test.mjs`               | T5                                                 | 30 sur 31    | 31 ok        |
| `state-root.test.mjs`       | T6                                                 | 2 sur 2      | 2 ok         |
| `recette-13.test.mjs`       | recette13-push.mjs et recette13-push2.mjs          | 64 sur 260   | 260 ok       |

Les tests qui passaient déjà avant sont les cas de non-régression (lectures, formes permises, commandes
ordinaires) et, pour T1, les formes que l'ancien découpage voyait déjà par chance (`case`, `for i (1)`,
`$(…)` dans `${…}`).

### pnpm check

Deux passes, code de sortie 0 chacune, séparées par `docker compose down -v` (projet
`siteperso-v3-lot13bis` : conteneur et volume de test supprimés puis recréés, « Healthy ») :

| Étape de `pnpm check`               | Passe 1                          | Passe 2 (base neuve)             |
| ----------------------------------- | -------------------------------- | -------------------------------- |
| `pnpm hooks:test`                   | 527 sur 527                      | 527 sur 527                      |
| `pnpm integrity:test`               | 19, 3 et 8 réussis               | 19, 3 et 8 réussis               |
| `pnpm integrity` (origin/develop)   | OK (divergence 802360b24c14)     | OK (divergence 802360b24c14)     |
| unitaires contrats / API            | 133 / 391                        | 133 / 391                        |
| e2e API (rejoués, hors cache)       | 552                              | 552                              |
| couverture fusionnée API, contrats  | 943 et 133 tests, 100 % partout  | 943 et 133 tests, 100 % partout  |

Le lot ne touche ni au code applicatif ni aux tests Vitest : ces nombres sont ceux du lot 13.

### Tableau avant/après des cas de recette

Les scripts de recette lancés par un agent sont refusés par le hook (démonstration dans « Points
ouverts ») ; le tableau vient donc de `recette-13.test.mjs`, qui rejoue exactement les mêmes 130
commandes par la même entrée (`guard.mjs pre-tool-use`, JSON sur stdin, `CLAUDE_PROJECT_DIR` posé sur
un dépôt temporaire : aucun état écrit hors de son dossier), pour la session principale (`main`) et
pour `dev-api`. « avant » : code de `develop` (`802360b`) ; « après » : code du lot. En gras, les
verdicts qui changent : 34 pour `main`, 30 pour `dev-api`, tous de PERMIS à REFUSE. Les scripts
d'origine ne lançaient `recette13-push.mjs` que pour `main` ; la colonne `dev-api` est ajoutée.

| # | Script | Commande (forme JSON) | main avant | main après | dev-api avant | dev-api après |
| -: | :-: | --- | --- | --- | --- | --- |
| 1 | push | `` "git push origin feature:develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 2 | push | `` "git push origin HEAD:develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 3 | push | `` "git push origin refs/heads/develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 4 | push | `` "git push origin refs/heads/develop:refs/heads/develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 5 | push | `` "git push origin develop:refs/heads/main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 6 | push | `` "git push origin develop main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 7 | push | `` "git push origin develop develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 8 | push | `` "git push https://example.com/x.git develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 9 | push | `` "git push git@github.com:x/y.git develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 10 | push | `` "git push . develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 11 | push | `` "git push --repo=https://x develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 12 | push | `` "git push origin develop -o x" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 13 | push | `` "git push --force-with-lease origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 14 | push | `` "git push -fu origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 15 | push | `` "git push --receive-pack=x origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 16 | push | `` "git push origin \"develop\"" `` | PERMIS | PERMIS | REFUSE | REFUSE |
| 17 | push | `` "git push origin 'main'" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 18 | push | `` "git push origin $BR" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 19 | push | `` "git push origin ${BR:-main}" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 20 | push | `` "git push origin dev\"\"elop" `` | PERMIS | PERMIS | REFUSE | REFUSE |
| 21 | push | `` "git push origin $(echo main)" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 22 | push | `` "git push origin `echo main`" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 23 | push | `` "git push origin develop;git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 24 | push | `` "git push origin develop && git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 25 | push | `` "git push origin develop \| git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 26 | push | `` "(git push origin main)" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 27 | push | `` "{ git push origin main; }" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 28 | push | `` "env git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 29 | push | `` "command git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 30 | push | `` "/usr/bin/git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 31 | push | `` "exec git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 32 | push | `` "sudo git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 33 | push | `` "xargs git push origin <<< main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 34 | push | `` "nohup git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 35 | push | `` "time git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 36 | push | `` "bash -c \"git push origin main\"" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 37 | push | `` "sh -c 'git push origin main'" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 38 | push | `` "GIT_DIR=/x git push origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 39 | push | `` "git -c remote.origin.url=https://x push origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 40 | push | `` "git -c url.https://x.insteadOf=git@ push origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 41 | push | `` "git -c core.sshCommand=x push origin develop" `` | PERMIS | **REFUSE** | REFUSE | REFUSE |
| 42 | push | `` "git -c push.default=matching push origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 43 | push | `` "git --git-dir=/x push origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 44 | push | `` "git -C /tmp push origin develop" `` | PERMIS | PERMIS | REFUSE | REFUSE |
| 45 | push | `` "git -C /tmp/nonexistent push origin develop" `` | PERMIS | PERMIS | REFUSE | REFUSE |
| 46 | push | `` "git --exec-path=/x push origin develop" `` | PERMIS | **REFUSE** | REFUSE | REFUSE |
| 47 | push | `` "git config remote.origin.url https://x" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 48 | push | `` "git remote set-url origin https://x" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 49 | push | `` "git remote rename origin foo" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 50 | push | `` "git remote add origin2 https://x" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 51 | push | `` "git config --global url.https://x.insteadOf git@github.com:" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 52 | push | `` "git config remote.origin.pushurl https://x" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 53 | push | `` "git config remote.origin.push refs/heads/*:refs/heads/main" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 54 | push | `` "git branch -f develop main" `` | PERMIS | PERMIS | PERMIS | PERMIS |
| 55 | push | `` "git update-ref refs/heads/develop main" `` | PERMIS | PERMIS | PERMIS | PERMIS |
| 56 | push | `` "git checkout -B develop main" `` | PERMIS | PERMIS | PERMIS | PERMIS |
| 57 | push | `` "git reset --hard main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 58 | push | `` "git config alias.p push" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 59 | push | `` "git p origin main" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 60 | push | `` "git config alias.p \"!git push origin main\"" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 61 | push | `` "git config --add alias.q \"!f(){ git push origin main; }; f\"" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 62 | push | `` "git send-pack https://x main" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 63 | push | `` "git http-push https://x main" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 64 | push | `` "git svn dcommit" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 65 | push | `` "gh pr merge 1" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 66 | push | `` "gh release create v1" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 67 | push | `` "git tag v1" `` | PERMIS | PERMIS | PERMIS | PERMIS |
| 68 | push | `` "git merge develop" `` | PERMIS | PERMIS | PERMIS | PERMIS |
| 69 | push | `` "echo \"git push origin main\" \| sh" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 70 | push | `` "echo \"git push origin main\" > /tmp/x.sh && sh /tmp/x.sh" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 71 | push | `` "git push origin develop\ngit push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 72 | push | `` "git push\torigin\tmain" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 73 | push | `` "git push origin develop  # main" `` | PERMIS | PERMIS | REFUSE | REFUSE |
| 74 | push | `` "git push origin develop #\ngit push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 75 | push | `` "git push origin develop:develop" `` | PERMIS | PERMIS | REFUSE | REFUSE |
| 76 | push | `` "git push --no-thin origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 77 | push | `` "git push --atomic origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 78 | push | `` "git push --dry-run origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 79 | push | `` "git push --porcelain origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 80 | push | `` "git push --signed origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 81 | push | `` "git push -q origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 82 | push | `` "git push --verbose origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 83 | push | `` "git push --set-upstream=x origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 84 | push | `` "git push --progress origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 85 | push | `` "git push -u origin main develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 86 | push | `` "git push origin  main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 87 | push | `` "git push origin +develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 88 | push | `` "git push -- origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 89 | push | `` "alias gp=\"git push\"; gp origin main" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 90 | push | `` "function g(){ git push origin main; }; g" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 91 | push | `` "git \"push\" origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 92 | push | `` "\"git\" push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 93 | push | `` "git pu\\sh origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 94 | push | `` "git push origin ma\\in" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 95 | push | `` "GIT_SSH_COMMAND=x git push origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 96 | push | `` "git -c \"remote.origin.url=x\" push origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 97 | push | `` "git -cremote.origin.url=x push origin develop" `` | PERMIS | **REFUSE** | REFUSE | REFUSE |
| 98 | push | `` "git -Ctmp push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 99 | push | `` "git -C=x push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 100 | push | `` "git --work-tree=/x push origin develop" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 101 | push | `` "git push origin develop --mirror" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 102 | push | `` "git push origin develop --all" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 103 | push | `` "git push --tags" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 104 | push | `` "git push origin develop refs/tags/v1" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 105 | push2 | `` "{ git push origin main; }" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 106 | push2 | `` "{ git push origin develop; }" `` | PERMIS | PERMIS | PERMIS | **REFUSE** |
| 107 | push2 | `` "if true; then git push origin main; fi" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 108 | push2 | `` "for i in 1; do git push origin main; done" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 109 | push2 | `` "while true; do git push origin main; done" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 110 | push2 | `` "! git push origin main" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 111 | push2 | `` "git send-pack git@github.com:x/y.git main" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 112 | push2 | `` "git -cremote.origin.url=x push origin develop" `` | PERMIS | **REFUSE** | REFUSE | REFUSE |
| 113 | push2 | `` "git config remote.origin.url https://x" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 114 | push2 | `` "git remote set-url origin https://x" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 115 | push2 | `` "function g(){ git push origin main; }; g" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 116 | push2 | `` "git push origin main &" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 117 | push2 | `` "coproc git push origin main" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 118 | push2 | `` "git push origin main \|\| true" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 119 | push2 | `` "git push origin main\r" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 120 | push2 | `` "{git push origin main;}" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 121 | push2 | `` "git push origin develop && { git push origin main; }" `` | PERMIS | **REFUSE** | REFUSE | REFUSE |
| 122 | push2 | `` "git \"push\" origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 123 | push2 | `` "git push origin main #x" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 124 | push2 | `` "git\\\n push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 125 | push2 | `` "FOO=1 git push origin main" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 126 | push2 | `` "git push origin main 2>&1" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 127 | push2 | `` "$(git push origin main)" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 128 | push2 | `` "echo $(git push origin main)" `` | REFUSE | REFUSE | REFUSE | REFUSE |
| 129 | push2 | `` "<(git push origin main)" `` | PERMIS | **REFUSE** | PERMIS | **REFUSE** |
| 130 | push2 | `` "git push origin main <<< x" `` | REFUSE | REFUSE | REFUSE | REFUSE |

## Non fait

- `policy.mjs` : inchangé (rien à y mettre ; la classification des chemins de configuration git est dans
  `guard.mjs`, qui seul voit les chemins absolus et `HOME`).
- Scripts de recette lancés tels quels par l'agent : refusés par le hook, non contournés (voir « Points
  ouverts »). Les copies adaptées (avec `CLAUDE_PROJECT_DIR` posé sur le dossier passé en argument)
  sont dans le dossier temporaire de session, `lot13bis/recette/`, pour la session principale.
- Aucun changement de code applicatif, de tests Vitest, de CI, de `docs/lots.md` ni du backlog.

## Décisions

1. **Réécrire le lecteur plutôt que retirer des mots réservés** du découpage existant. Motif : retirer
   `{`, `if`, `do`… ne suffisait pas pour `<(…)` (le mot suivant était avalé comme cible de
   redirection), `"$(…)"` (le contenu des guillemets n'était pas lu), les here-documents non protégés,
   `$((1<<2))` (faux here-document qui cachait les lignes suivantes) ni les fonctions `f(){`. Alternative
   écartée : la liste de mots réservés, qui laissait ces trous.
2. **Illisible donc refusé, sauf résolution sûre** : seules les variables affectées en clair dans la
   même commande, `HOME`, `~` et `PWD` sont résolues. Alternative écartée : lire `process.env` du hook,
   qui n'est pas l'environnement du shell de l'outil Bash (profil zsh chargé, `TMPDIR` propre…) ; une
   valeur fausse ferait passer une cible. Conséquence pour tous les agents : écrire les chemins en clair
   (reporté dans `CLAUDE.md`).
3. **Code shell en ligne analysé comme une commande, scripts lus comme code opaque.** Analyser
   récursivement le fichier d'un script (`bash script.sh`) refuserait presque tout script réel (ses
   `$1`, `$tmp`… sont illisibles hors exécution). Alternative écartée pour cette raison ; le script
   reste soumis à la recherche de git push, de primitives d'écriture et de chemins d'oracles, et doit
   exister, être lisible et ne pas être écrit par la même commande.
4. **Alias git de la configuration résolus, commande git inconnue refusée.** La limite « alias de
   l'hôte » du lot 13 disparaît : `git p` est développé par `git config --get alias.p` et analysé (un
   alias qui contient push est refusé). Alternative écartée : laisser passer une sous-commande inconnue.
   Conséquence : `git lfs`, `git flow` (extensions) sont refusés ; aucune n'est utilisée par le projet.
5. **Liste fermée avec git push** (options globales `-C`, `-c`, `--no-pager`, `-P` ; clés `color.*`,
   `advice.*`, `user.*`, `i18n.*`, `core.quotepath`). Motif : la liste d'exclusion du lot 13 laissait
   `core.sshCommand`, `include.path`, `http.*`, `credential.*`, `--exec-path` (recette). Alternative
   écartée : allonger la liste d'exclusion. Les formes de la règle en vigueur (`-C <chemin>`, `-c` en
   option) restent permises.
6. **Ajouts au-delà de la lettre des tickets, au même motif** : `include.*` et `includeIf.*` (T3 : une
   inclusion redéfinit `remote.*` sans le nommer) ; `git svn dcommit`, `git p4 submit` et les
   exécutables `git-<cmd>` (T2) ; `gh repo archive|unarchive|sync`, `gh release delete-asset`, toute
   action `delete`, `gh alias set|import`, sous-commande gh inconnue (T5). Chacun est refusé avec son
   motif et testé.
7. **Motif le plus précis conservé** : un refus « nom de commande illisible » ne remplace pas un motif
   déjà trouvé (par exemple `<(git push origin main)` garde « main est réservée à Julien »). Sinon, comme
   avant, le dernier motif l'emporte (les tests existants en dépendent).
8. **Substitution de processus résolue en `/dev/fd/63`** (ce que bash passe réellement) : `tee >(…)` ou
   `> >(…)` n'est pas une écriture de fichier, la commande intérieure est analysée.
9. **Variables connues transmises au code imbriqué** : exact pour `eval`, `trap` et les alias ;
   surestimation prudente pour `sh -c` (seules les variables exportées y passent réellement).
10. **Commits intermédiaires réellement vérifiés** : l'analyseur a été écrit d'un bloc puis réduit et
    reconstruit trou par trou ; à chaque commit, `pnpm hooks:test` n'échouait que dans les fichiers des
    trous suivants, et la version finale est identique à celle validée d'un bloc (à un commentaire et à
    un caractère inutile retiré de `pathCandidates` près).

## Limites connues restantes

- Un programme ordinaire qui écrit ou pousse lui-même (script de `package.json` lancé par `pnpm run`,
  `make`, binaire, module `python -m`, extension) : seul son nom est lu.
- Un alias ou une fonction du shell définis dans la configuration de l'hôte (`~/.zshrc` chargé par
  l'outil Bash) : le hook ne voit pas cette configuration. Les alias git, eux, sont résolus.
- Le contenu écrit par une commande lisible mais construit à l'exécution (`echo "$X" > f.spec.ts` où `X`
  contient un marqueur) : la cible est vérifiée, pas le contenu ; le hook de fin le voit.
- Un script exécuté est lu comme code opaque, pas analysé comme une commande (décision 3).
- Enveloppes non reconnues (`taskset`, `chrt`, `strace`, `parallel`…) : la commande enveloppée n'est pas
  analysée.
- `cd` dans un élément de tube (`cd x | …`) : traité comme s'il s'appliquait à la suite (zsh) ; bash
  l'exécuterait dans un sous-shell.
- sed et awk : la commande `w` de sed est lue ; les autres façons d'écrire d'un programme sed ou awk ne
  sont repérées que par la recherche de primitives et de chemins d'oracles.
- Le hook de fin (empreintes), le script d'intégrité de la CI et la protection de `.git` par Claude Code
  restent les filets ; les hooks ne sont pas un bac à sable.

## Points ouverts

1. **Scripts de recette non lancés par l'agent (sortie honorable).** Démonstration :
   `node <scratchpad>/lot13bis/recette/recette13-push2.mjs <worktree>` → « Garde-fous : refusé. git push
   dans du code opaque (node) : la branche et le remote ne sont pas vérifiables ; seule la session
   principale pousse… ». Le refus est la règle (un agent ne lance pas un code qui contient git push ni
   les scripts des garde-fous) ; je ne l'ai pas contourné. Le tableau vient de `recette-13.test.mjs`
   (mêmes commandes, même entrée du hook). La session principale peut lancer les copies adaptées :
   `node <scratchpad>/lot13bis/recette/recette13-push.mjs <worktree>` (idem `recette13-push2.mjs`) ;
   elles posent `CLAUDE_PROJECT_DIR` sur le worktree passé en argument.
2. **Encore permis, hors T1 à T6, à trancher par Julien** : `git tag v1` (création locale d'une
   étiquette, alors que les étiquettes lui sont réservées ; leur push est déjà refusé), `git merge
   develop` lancé sur `main` (fusion dans `main` réservée ; le hook ne connaît pas la branche courante),
   `git branch -f develop main`, `git update-ref refs/heads/develop …`, `git checkout -B develop …`
   (redéfinissent le contenu local de `develop` avant un push permis). Je n'ai pas inventé de règle.
3. **Effet sur les sessions** : les hooks actifs sont ceux du checkout principal
   (`$CLAUDE_PROJECT_DIR/.claude/hooks/run.sh`) ; ces règles ne s'appliquent qu'une fois le lot fusionné
   dans `develop` et le checkout principal à jour. Pendant ce lot, mes commandes passaient encore par
   l'ancien analyseur (il a d'ailleurs refusé `> $F/…` sans résoudre la variable ; j'ai écrit le chemin
   en clair).
4. **Changement de pratique pour les agents** (reporté dans `CLAUDE.md`) : une cible ou un dossier
   courant calculés sont refusés (`tmp=$(mktemp -d); … > "$tmp/x"`, `cd "$w" && …` suivi d'une
   écriture relative) ; `S=/chemin; … > $S/x` reste permis. Les orchestrateurs qui écrivent des
   commandes avec des variables devront les écrire en clair. La liste « commandes ordinaires » de
   `shell-compound.test.mjs` fixe ce qui doit rester permis ; elle est à compléter si une commande
   courante légitime se révèle refusée.
5. **Refus journalisés pendant le lot** (`.claude/hooks/audit.log` du checkout principal) : un Write de
   test qui citait le dossier d'état des garde-fous (ligne `.gitignore` du dépôt temporaire, retirée :
   elle n'était pas nécessaire), une écriture `> $F/…` dans le dossier temporaire (chemin écrit en
   clair ensuite), le lancement direct d'un script de recette (point 1).
