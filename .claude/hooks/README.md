# Garde-fous des agents (couche 1)

Hooks Claude Code déclarés dans `.claude/settings.json`, lancés par `run.sh` (refus si Node ou le
script manquent). Ils empêchent un agent d'obtenir des tests verts en touchant aux tests plutôt
qu'au code. Le rôle de l'agent vient du champ `agent_type` de l'entrée du hook (le `name` de son
fichier dans `.claude/agents/`) ; la session principale a le rôle `main`.

| Événement                       | Mode                              | Effet                                                                                                                               |
| ------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`, `SubagentStart` | `session-start`, `subagent-start` | instantané (sha256) des oracles du dépôt courant ; rappel des règles injecté au sous-agent                                          |
| `PreToolUse` (édition, shell)   | `pre-tool-use`                    | refus (code 2, raison sur stderr) de toute écriture d'un oracle ou d'un marqueur ; instantané paresseux d'un autre dépôt (worktree) |
| `Stop`, `SubagentStop`          | `verify`                          | compare les oracles à l'instantané ; refuse une fois la fin de tâche si l'un a changé sans autorisation ni commit justifié          |
| `PostToolUse` sur `Agent`       | `report`                          | signale à l'orchestrateur les violations laissées par un sous-agent                                                                 |

Oracles : fichiers de test existants (`*.spec.*`, `*.e2e-spec.*`, `*.test.*`, fixtures, dossiers
`test/`, `tests/`, `__snapshots__/`), configurations Vitest et de couverture, configurations du
test par mutation (`stryker.config.mjs` et toute variante `stryker.<x>.<ext>` que Stryker lit,
`tsconfig.stryker.json` de son vérificateur, `stryker.equivalents.json` des mutants équivalents
déclarés), `turbo.json` (racine et de paquet), `pnpm-workspace.yaml`, `.husky/`, `.github/workflows/`, `scripts/ci/`, et `.claude/` (réglages,
hooks, agents). Créer un nouveau fichier de test est permis. Les marqueurs de saut ou de focus de
Vitest et les commentaires d'ignore de couverture sont refusés partout (`lib/policy.mjs`). Le
marqueur d'échec attendu `fails` n'est repéré que sur un appel direct ou enchaîné par des méthodes
de l'API de test de Vitest (`each`, `for`, `concurrent`, `extend`…), pas sur un appel ordinaire
comme `includes` sur la portée du même nom de `GRANTABLE` (BF-9, `tests/fails-marker.test.mjs`). Un
marqueur interdit est repéré devant une parenthèse, ou devant une méthode quelconque suivie d'une
parenthèse ou d'un gabarit, précédée d'autant de méthodes de l'API de test qu'on veut (un saut, puis
`concurrent`, puis `each` : L14-11, `tests/marker-chain.test.mjs`, qui compare l'ancien et le
nouveau sur tout le corpus). Une directive `Stryker disable` d'un fichier JS/TS qui ne cite pas
l'identifiant d'un mutant équivalent déclaré dans un `stryker.equivalents.json` du dépôt est
refusée dès l'écriture, à toutes les sessions, par Edit, Write et le shell ; une directive déjà
présente ne bloque pas les autres modifications du fichier (L14-01,
`tests/stryker-directive-write.test.mjs`). Le dossier temporaire de session (`scratchpad_dir`) est
libre.

Front (`apps/web`, lot F0) : parcours Playwright `*.e2e.ts`, tests de composants `*.spec.ts`,
fixtures et `test/` comme ci-dessus, captures attendues de Playwright (`<fichier de test>-snapshots/`)
et captures de référence du handoff (`apps/web/design/handoff-v6/design/reference/`, oracles de
classe « test » hors des chemins d'écriture de la qa) ; configurations `vitest.config.ts`,
`playwright.config.ts` (et ses variantes `playwright.<x>.config.<ext>`), `stryker.config.mjs`.
Marqueurs de Playwright, repérés après `test` ou `test.describe` : `fixme` et `slow` refusés comme
`skip`, `fail` traité comme l'échec attendu `fails` de Vitest (portée `fails`). Rôles limités :
`qa-front` (tests et comptes rendus, comme `qa`), `revue-a11y` (`docs/revues/`, comme les autres
revues). Tests : `tests/front-oracles.test.mjs` et `scripts/ci/tests/front-integrity.test.sh`.

## Vérification de fin de tâche (instantanés)

L'instantané d'un dépôt relève, pour une clé (agent ou session), le commit `head`, l'empreinte de
chaque oracle et celle de chaque fichier non suivi. En fin de tâche (`verify`, `lib/state.mjs`) :

- un oracle de l'instantané dont l'empreinte a changé est « modifié » ou « supprimé », sauf
  autorisation ou commit justifié depuis `head` ;
- une configuration ou un garde-fou absent des oracles de l'instantané n'est « créé » ou « modifié »
  que si son contenu diffère de celui qu'il avait à l'instantané (fichier au commit `head`, ou
  fichier non suivi relevé). La politique a pu s'élargir entre-temps (les hooks tournent depuis le
  checkout principal, mis à jour par une fusion) : un fichier devenu oracle mais inchangé n'est pas
  une violation (BF-10, `tests/snapshot-policy-widening.test.mjs`) ;
- un fichier devenu test depuis l'instantané (politique élargie) qui existait déjà (commit `head`
  ou fichier non suivi relevé) est un test existant : le modifier par Edit, Write ou le shell exige
  une autorisation « tests » dès ce moment, et la fin de tâche signale sa modification ou sa
  suppression sans autorisation ni commit justifié ; un test créé pendant la tâche reste libre
  (L14-12, `tests/test-widening.test.mjs`) ;
- l'instantané d'une racine disparue, ou d'un dossier qui n'est plus ce dépôt (plus de `.git`, ou
  `git rev-parse --show-toplevel` différent) et que git ne liste plus parmi les worktrees du
  projet, est ignoré et supprimé : worktree retiré dont un outil a recréé des fichiers (serveur
  `nuxt dev` orphelin). Si le worktree reste enregistré (`.git` retiré à la main), une seule
  violation est signalée, pas une par oracle (BF-11, `tests/snapshot-retired-root.test.mjs`).

## Exception contrôlée (correcteur, qa, qa-front, lead-architecte, dev-devops)

Seule la session principale crée une autorisation (le hook refuse aux sous-agents l'exécution des
scripts de ce dossier) :

```sh
node .claude/hooks/authorize.mjs grant --agent correcteur --scope tests --ticket RC-12 \
  --reason "test faux établi par le triage" --path apps/api/test/errors.e2e-spec.ts
node .claude/hooks/authorize.mjs list
node .claude/hooks/authorize.mjs revoke --id <identifiant>
```

Portées : `tests` (correcteur, qa, qa-front ; dev-contrats, dev-sql, dev-api seulement quand un brief validé
par Julien rend le test obsolète) modifier un test existant ; `fails` (qa, qa-front, correcteur) écrire un
test en échec attendu ; `config` (lead-architecte, dev-devops) une configuration protégée. Une
autorisation vise des chemins précis, expire (4 h par défaut) et se lie au premier sous-agent qui
l'utilise. Création, usage, refus, révocation et violations sont journalisés dans
`.claude/hooks/audit.log`. État et journal sont gitignorés, sous le checkout principal.

Le commit qui modifie un test existant ou une configuration protégée porte en plus la ligne
`Justification-test: <identifiant> <raison>`, exigée par `scripts/ci/check-tests-integrity.sh`.
Pour une directive `Stryker disable` (L14-02), c'est le commit qui ajoute la ligne qui porte la
justification, ses lignes `Justification-test` citent l'identifiant de chaque équivalent de la
directive (mot entier, depuis le 20 nov. 2026), et chaque équivalent cité désigne dans son `stryker.equivalents.json` le fichier,
la ligne et le mutateur (champ `mutator`, obligatoire depuis le 20 nov. 2026) que la directive
retire du score (`scripts/ci/stryker-directives.mjs`).

## git push (git flow, décision de Julien du 19 nov. 2026)

Seule la session principale (rôle `main`, entrée sans `agent_type`) pousse, et sous une seule
forme : `git push origin develop`, `git push -u origin develop` ou
`git push --set-upstream origin develop` (refspec `develop:develop` admise), éventuellement
précédée de `-C <chemin>`, `--no-pager`, `-P` ou d'un `-c <clé>=<valeur>` sans effet sur la
destination (`color.*`, `advice.*`, `user.*`, `i18n.*`, `core.quotepath`). La forme peut se trouver
dans une liste ou un bloc (`{ … ; }`, `if … then … fi`, `cmd && git push origin develop`) : ce qui
compte est qu'elle soit lisible. `lib/shell.mjs` (`pushRefusal`) refuse tout le reste avec son motif :

- tout git push d'un agent, quelle que soit la forme ;
- autre remote qu'`origin` ; autre branche ou refspec (`main`, `master`, `HEAD`, `+…`, `:…`,
  `lot/*`, `release/*`, étiquette, `refs/tags/…`), plusieurs refspecs, refspec calculée (`$BR`) ;
- refspec absente (`git push`, `git push origin`) : le résultat dépend de la configuration ;
- `--force`, `-f`, `--force-with-lease`, `--force-if-includes`, `--delete`, `-d`, `--prune`,
  `--all`, `--branches`, `--mirror`, `--tags`, `--follow-tags`, `--push-option`, `-o`,
  `--no-verify`, `--repo`, `--receive-pack`, `--exec`, `--` et toute autre option ;
- ce qui change la destination ou la connexion autour du push : toute option globale autre que
  `-C`, `-c`, `--no-pager`, `-P` (`--git-dir`, `--work-tree`, `--namespace`, `--config-env`,
  `--exec-path`…), toute clé `-c` hors de la liste ci-dessus (`remote.*`, `url.*`, `push.*`,
  `branch.*`, `alias.*`, `include.*`, `core.sshCommand`, `http.*`, `credential.*`…), `-c` collé à
  sa valeur compris (`git -cremote.origin.url=x`, lu comme `-c remote.origin.url=x`), variable
  `GIT_*` en tête de commande ou affectée plus tôt dans la commande (`export GIT_DIR=…; git push …`) ;
- un push caché : alias git qui lance push (`-c alias.…`, `git config alias.…`, alias de la
  configuration résolu par `git config --get alias.<nom>`), alias ou fonction du shell, `trap`,
  `git … push` dans du code opaque (`bash -c`, `eval`, `xargs`, `env -S`, `watch`, `pnpm exec`,
  script, here-document), commande lancée par git (`core.pager`, `core.editor`, `rebase --exec`,
  `submodule foreach`, `bisect run`), exécutable `git-push` appelé directement ; hors scripts des
  garde-fous, lancés par la session principale seulement.

Refusé à tous les rôles, session principale comprise (lot 13 bis) :

- la plomberie de push : `git send-pack`, `git http-push` (et `git-send-pack`, `git-http-push`),
  ainsi que `git svn dcommit` et `git p4 submit` qui publient vers un autre dépôt ;
- la redéfinition de la destination : `git remote add|rename|remove|rm|set-url`, `git config` en
  écriture (quelle que soit la portée, `--global`, `--system`, `--local`, `--file`) sur `remote.*`,
  `url.*`, `push.*`, `branch.*.remote`, `branch.*.pushRemote`, `branch.autoSetupMerge`,
  `branch.autoSetupRebase` (L18-02), `include.*`, `includeIf.*`, ou sur une section de ces
  familles, `git config --edit`, et l'écriture de la configuration git (`.git/config`,
  `config.worktree`, `~/.gitconfig`, `~/.config/git/config`, `/etc/gitconfig`) par Edit, Write, le
  shell ou un code opaque. Les lectures restent permises, `core.hooksPath` compris (L18-01) :
  `git config --get|--get-all|--get-regexp|--list`, `git config get|list`, `git config <clé>`
  sans valeur, `git remote -v`. Une écriture se lit aux options à leur place (la valeur de
  `--comment`, `--default` ou `--file` n'est pas une action) et un préfixe d'action d'écriture
  (`--unset-a`) compte comme écriture ; écrire, retirer ou renommer `core.hooksPath` (ou la
  section `core`) reste refusé. Tests : `tests/config-read.test.mjs` ;
- `core.hooksPath` hors de `git config` (L19-02, décision de Julien du 21 nov. 2026), comme
  `git -c core.hooksPath=` : `GIT_CONFIG_PARAMETERS` qui le nomme, `GIT_CONFIG_KEY_<n>` qui le vaut
  (avec `GIT_CONFIG_COUNT`, git >= 2.31), en tête de commande, par `env`, `export`, `declare -x` ou
  une affectation plus loin ; `--config-env core.hooksPath=<variable>` ; un fichier inclus depuis la
  ligne de commande ou l'environnement (`-c include.path=`, `-c includeIf.*.path=`, les mêmes clés
  par ces variables), qui peut le fixer. Une valeur calculée de `GIT_CONFIG_PARAMETERS`,
  `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<n>` ou `GIT_CONFIG_VALUE_<n>` (`+=`, `read`, `printf -v`,
  `declare -n` compris) et une clé `-c` ou `--config-env` calculée sont illisibles, donc refusées.
  `GIT_CONFIG_GLOBAL` et `GIT_CONFIG_SYSTEM` restent permis : ils passent après la configuration
  locale où husky pose la clé. Tests : `tests/hookspath-env.test.mjs` ;
- `gh` pour ce qui fusionne, étiquette, publie ou supprime : `gh pr merge`,
  `gh release create|delete|delete-asset|edit|upload`,
  `gh repo delete|edit|rename|archive|unarchive|sync`, toute action `delete`, `gh alias set|import`, `gh api` avec une méthode autre que GET ou avec `-f`, `-F`,
  `--field`, `--raw-field`, `--input`, et une sous-commande gh inconnue (alias ou extension). Les
  lectures (`gh pr view|list|checks`, `gh run view|list|watch`, `gh api` en GET) restent permises.

Fusionner dans `main` (branches `release/*`, `hotfix/*`), créer ou pousser une étiquette, pousser
`main`, supprimer une branche distante et déployer sont réservés à Julien. Les refus de
`permissions.deny` (`.claude/settings.json`) doublent les variantes dangereuses qui s'écrivent en
préfixe (push forcé, plomberie, `git remote …`, `gh pr merge`, `gh release …`, `gh repo …`, édition
de `.git/config` et `~/.gitconfig`) ; l'autorité reste ce hook.

## Branche locale main et worktrees (lot 14)

Branche locale `main` (L14-06, décision de Julien du 19 nov. 2026) : aucune session, la principale
comprise, ne l'écrit, car une écriture locale partirait dans le prochain push de Julien. Refusés :

- quand la branche courante est `main` : `git commit` (hors `--dry-run` ; décision de Julien du
  20 nov. 2026) et ses équivalents `citool`, `gui` (hors `blame`, `browser`, `version`),
  `quiltimport` (hors `--dry-run`), `svn rebase`, `p4 rebase` ; `git merge`, `pull`, `rebase`,
  `cherry-pick`, `revert`, `am` (hors `--abort`, `--quit`) et `git reset <commit>` qui déplace la
  branche (`git reset`, `reset --hard` vers `HEAD` et `reset -- <chemins>` restent permis) ;
- quelle que soit la branche courante : `git branch` qui crée, force, renomme, copie vers ou
  supprime `main`, `checkout -b|-B|--orphan|--track` et `switch -c|-C|--orphan|--track` vers `main`,
  `worktree add -b|-B main`, `update-ref` (et `--stdin`) sur `refs/heads/main` ou sur `HEAD` quand
  elle est `main`, `symbolic-ref refs/heads/main`, `fetch` ou `pull` vers `main` (`…:main`),
  `rebase <amont> main`, `stash branch main`, `fast-import` dont le flux écrit `main` (`commit` ou
  `reset` de `refs/heads/main` ; flux lu sur un tube ou calculé : illisible), `replay` qui écrit
  `main` (`--ref`, `--advance`, `--revert`) ou des branches déduites du parcours (`--onto` sans
  `--ref`, `--contained`), sauf `--ref-action=print`, et `rebase --update-refs` (branches du
  parcours) ;
- les formes voisines de la création de `main` (L19-01, décision de Julien du 21 nov. 2026) :
  options courtes groupées ou collées à leur valeur (`checkout -qb main`, `-bmain`,
  `switch -cmain`, `worktree add -qbmain`), options longues abrégées (`switch --cr main`,
  `--force-c`, `checkout --or main`, `branch --cop develop main`, `--mo`, `--de`), `--track` sans
  nom groupé ou abrégé (`checkout -qt origin/main`, `--tr`, `-t remotes/origin/main`), branche
  distante devinée quand `main` n'existe pas en local (`checkout main`, `switch main`,
  `worktree add ../main`, `worktree add <dossier> main`) et `worktree add --orphan ../main`. Une
  `main` locale existante reste un passage permis. Option ou valeur collée calculée (`-$X`,
  `-qb"$NOM"`) et dossier calculé sans point de départ (`worktree add "$D"`) : illisibles, donc
  refusés. Tests : `tests/main-glued-options.test.mjs`.

La branche courante est lue dans le dépôt (`git symbolic-ref`) ou suivie dans la commande quand elle
y change (`checkout`, `switch`, `worktree add`, `symbolic-ref HEAD`, `rebase <amont> <branche>`,
sous-shells et code imbriqué compris). Illisible (dossier ou dépôt calculé, `--git-dir`, `GIT_DIR`,
`checkout -`, dossier qui n'existe pas encore), l'écriture est refusée ; un nom de branche écrit
illisible aussi. Restent permis par la même décision : l'étiquette locale (`git tag`, son push étant
refusé) et le déplacement local de `develop` (`branch -f`, `update-ref`, `checkout -B`), ainsi
que le commit sur toute autre branche, y compris après un changement de branche dans la même
commande. Tests : `tests/main-branch.test.mjs`, `tests/main-commit.test.mjs`.

Branche suivie (L14-17, décision de Julien du 20 nov. 2026) : `git branch -u` et
`--set-upstream-to` écrivent `branch.<branche>.remote` et `branch.<branche>.merge` hors de la règle
des destinations de push ; ils sont refusés aux agents sous toutes les formes lues (valeur séparée
ou collée, groupe d'options courtes, abréviation de l'option longue, `--set-upstream` retiré par
git, alias, `-C`, code imbriqué, option illisible). La session principale garde
`git push -u origin develop` et `git branch -u`. Tests : `tests/branch-upstream.test.mjs`.

Création d'une branche suivie (L18-02, décision de Julien du 20 nov. 2026) : refusée aux agents
dès que git écrirait `branch.<branche>.remote` ; la session principale garde ces commandes
(dont `git worktree add -b lot/x <dossier> develop`). Refusés :

- `--track` explicite de `git branch`, `checkout`, `switch` et `worktree add`, quel que soit le
  point de départ (`-t`, `--track=direct|inherit`, abréviations `--tr…`, groupes `-ft`, `-tb`) ;
- la création quand le suivi automatique s'applique, selon `branch.autoSetupMerge` lu dans `-c`
  puis dans la configuration vue du dépôt : `true` (défaut) pour un point de départ distant
  (`origin/develop`, `refs/remotes/…`, `origin`, `@{u}`, ou un nom absent qui commence par un
  remote), `always` pour toute branche, `inherit` pour une branche qui a un amont, `simple` pour
  une distante de même nom ; valeur inconnue, variable `GIT_CONFIG*` ou dépôt illisible : refusé.
  Formes lues : `git branch <nom> [<départ>]` (`-f` compris), `checkout -b|-B` (collé `-ba`, groupe
  `-qb`), `switch -c|-C|--create|--force-create` (abréviations), `worktree add -b|-B`, sans point
  de départ = `HEAD` ;
- la branche distante devinée : `checkout <nom>` et `switch <nom>` (sans `--no-guess` ni
  `-c checkout.guess=false`), `worktree add <dossier> <nom>`, `worktree add <dossier>` avec
  `--guess-remote` ou `worktree.guessRemote`, quand `<nom>` n'est pas une révision locale et
  qu'une branche distante le porte ; dépôt illisible : refusé ;
- la copie d'une branche suivie (`git branch -c|-C|--copy`, git copie sa configuration) ;
- `git fetch` et `git pull` `--set-upstream` (et abréviations).

`--no-track` (dernier des deux mots, comme pour git) reste permis, de même que la création depuis
une branche locale, un commit (`origin/develop~0`) ou `--detach`/`--orphan`. Le motif ne remplace
pas un refus plus précis déjà posé (écriture de `main`). Comportement de git vérifié dans des clones
jetables (git 2.30.2 de l'hôte, 2.43.0 de l'image Playwright) ; le test rejoue chaque forme par git
avant de la vérifier refusée. Tests : `tests/branch-tracking.test.mjs`.

Worktrees (L14-13) : `git worktree remove` (forcé ou non), `move` et `prune` sont refusés aux agents,
sous toutes les formes (alias, `-C`, code imbriqué, `xargs`) ; la session principale les garde.
`git worktree list` et `add` restent permis. Tests : `tests/worktree.test.mjs`.

Non-régression (L14-07) : `tests/ordinary-commands.test.mjs` rejoue les 88 commandes ordinaires de
l'orchestrateur de la recette du lot 13 bis (toutes permises à la session principale), un
échantillon de celles d'un agent pour un rôle de chaque famille de chemins d'écriture, et les refus
de push de la recette du lot 13 pour chacun des quatorze rôles d'agent. Une règle plus stricte qui
refuse une de ces commandes ordinaires fait échouer `pnpm hooks:test`.

Fichiers d'agent (L14-14) : chaque `.claude/agents/*.md` se termine par la même section « Git et
garde-fous » (règles et conduite face à un refus, sans rien du fonctionnement des garde-fous) ;
`tests/agents-git-section.test.mjs` vérifie qu'elle est identique et finale dans les quatorze
fichiers et que chaque refus qu'elle déclare est effectif pour chaque rôle.

## Illisible donc refusé

L'analyseur (`lib/shell.mjs`) lit bash et zsh (le shell de l'outil Bash) récursivement : listes
(`;`, `&&`, `||`, `|`, `&`), blocs `{ … }` (y compris `{git …;}` de zsh), sous-shells, `if`,
`while`, `until`, `for` (et `for i (…) cmd` de zsh), `case`, `!`, fonctions (`function f`, `f()`,
`() { … }`), `coproc`, `repeat`, substitutions `$(…)`, accents graves et `${…}` (entre guillemets
compris), substitutions de processus `<(…)`, `>(…)`, `=(…)`, here-documents non protégés, tableaux,
`((…))` et `$((…))`. Un `cd` ou une affectation dans un sous-shell n'en sort pas. Les variables
affectées en clair plus tôt dans la commande, `HOME` (`~`) et `PWD` sont résolues.

Ce qu'il ne sait pas lire est refusé, jamais laissé passer en silence, pour toutes les règles
(push, oracles, marqueurs, écritures opaques) :

- syntaxe incomplète ou inconnue : guillemet, parenthèse, `${`, accent grave ou `case` non refermés,
  redirection sans cible, parenthèse collée à un mot (motif étendu, qualificatif de glob de zsh),
  `$[…]` ;
- nom de commande, sous-commande git ou gh calculés (`$CMD`, `"$(echo git)"`, `$=X` de zsh),
  sous-commande git qui n'est ni connue ni un alias lisible (commande externe `git-<nom>`) ;
- cible d'écriture calculée (`rm "$F"`, `> "$(pwd)/x"`, expansion d'accolades `a.{b,c}`) ou
  relative à un dossier courant calculé (`cd "$D" && rm x`, `cd -`) ;
- script exécuté calculé, absent, trop gros (plus de 512 Ko) ou écrit par la même commande
  (`echo … > s.sh && sh s.sh`) ; code en ligne calculé (`bash -c "$CODE"`, `eval "$C"`) ; code
  lu sur un tube (`… | sh`, `… | node`) ; here-document ou here-string d'un interpréteur avec
  expansions ; variable qui fait charger du code (`BASH_ENV`, `ENV`, `LD_PRELOAD`, `NODE_OPTIONS`
  avec `--require` ou `--import`…).

Le code shell en ligne (`sh -c`, `eval`, `trap`, valeur d'un alias, `env -S`, `watch`, `flock -c`,
`npx -c`, commandes lancées par git) est analysé comme une commande, en plus de la recherche de
git push et d'oracles dans du code opaque. Les enveloppes `env`, `command`, `exec -a`, `nocorrect`,
`time`, `timeout`, `nice`, `sudo`, `flock`, `pnpm|npm|yarn|bun exec|x|dlx`, `npx` sont retirées.

## Limites

Ce n'est pas un interpréteur : ce qu'un programme fait sans le nommer sur sa ligne de commande lui
échappe. Limites connues :

- un programme ordinaire qui écrit ou pousse par lui-même (script `package.json` lancé par
  `pnpm run`, `make`, binaire, module `python -m`, extension d'un outil) : seul son nom est lu ;
- un alias ou une fonction du shell déjà définis dans la configuration de l'hôte (`~/.zshrc` chargé
  par l'outil Bash) : le hook ne voit pas cette configuration ;
- le contenu écrit par une commande lisible mais construit à l'exécution (`echo "$X" > f.spec.ts`
  où `X` contient un marqueur) : la cible est vérifiée, pas le contenu ;
- un script exécuté est lu comme du code opaque (recherche de git push, de primitives d'écriture
  et de chemins d'oracles), pas analysé comme une commande ;
- la commande `w` de sed est lue, pas les autres façons d'écrire d'un programme sed ou awk.

Le hook de fin (empreintes) et le script d'intégrité de la CI sont les filets. Les hooks ne sont pas
un bac à sable : un agent déterminé peut écrire l'état local ; la CI ne dépend pas de cet état.

Tests : `pnpm hooks:test`.
