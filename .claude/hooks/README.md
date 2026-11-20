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
dossier temporaire de session (`scratchpad_dir`) est libre.

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
  une violation (BF-10, `tests/snapshot-policy-widening.test.mjs`).

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
  `url.*`, `push.*`, `branch.*.remote`, `branch.*.pushRemote`, `include.*`, `includeIf.*`, ou sur
  une section de ces familles, `git config --edit`, et l'écriture de la configuration git
  (`.git/config`, `config.worktree`, `~/.gitconfig`, `~/.config/git/config`, `/etc/gitconfig`) par
  Edit, Write, le shell ou un code opaque. Les lectures (`git config --get`, `git remote -v`)
  restent permises ;
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
