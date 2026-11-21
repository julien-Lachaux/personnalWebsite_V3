# Lot 20 : flux par pull request, garde-fous et organisation (lead-architecte)

Date : 21 nov. 2026. Branche `lot/20-flux-pr` (depuis `lot/19-garde-fous-charge` à `0c79db7`, le
lot 19 non fusionné y est donc inclus), worktree `.claude/worktrees/lot-20`, isolation
`siteperso-v3-lot20` (ports 5702 à 5705). Tickets L20-01 à L20-03 (`docs/backlog.md`, 7 septies
quater) ; L20-04 et L20-05 reviennent à dev-devops (une ligne chacun au backlog). Autorisation
« config » `ba38d5d5` (`.claude/hooks/**`, `.claude/agents/**`). Aucun test existant modifié : deux
fichiers de test créés. Rien poussé, aucun worktree géré, pas de `pnpm check` ni de mutation
(consigne, règle D26) ; pendant le lot, l'orchestrateur a suspendu commits et `pnpm hooks:test`
(saturation de la machine) : commits faits après son signal.

## Commits

| Commit | Ticket | Sujet |
| ------ | ------ | ----- |
| `410d9e9` | L20-01 à L20-05 | backlog, section 7 septies quater |
| `74c7b61` | L20-01 | hooks : écritures `gh` du flux par pull request réservées à la session principale, lectures seules pour les agents ; `pr-flow.test.mjs` |
| `a837de3` | L20-02 | hooks : rôle `revue-pr` sans aucun chemin d'écriture ; `revue-pr-scope.test.mjs` |
| `2b24f09` | L20-01 | README des garde-fous |
| `b7d2b7f` | L20-03 | section commune « Git et garde-fous » des quatorze fichiers d'agent |
| `51de7d3` | L20-03 | `CLAUDE.md`, `docs/03-organisation-agents.md` |
| (ce CR) | | compte rendu et trois patchs prêts (points ouverts 1 à 3) |

Les commits qui touchent `.claude/hooks/` ou `.claude/agents/` portent `Justification-test: L20-0x …`.

## L20-01 : hooks (fait, sauf le push des branches de lot : point ouvert 1)

### Règle appliquée (`lib/shell.mjs`, `analyzeGh`)

Deux listes fermées ; toute commande `gh` qui n'y figure pas est refusée à toutes les sessions.

- Lectures, à tous les rôles : `gh pr view|list|checks|diff|status`, `gh issue view|list|status`,
  `gh run view|list|watch`, `gh workflow view|list`, `gh release view|list`, `gh repo view|list`,
  `gh label|cache|secret|variable list`, `gh ruleset view|list|check`, `gh search …`,
  `gh auth status`, `gh status`, `gh version`, `gh help …`, `gh api` en GET sans champ (inchangé),
  un groupe seul (aide).
- Écritures, à la session principale seulement (un agent reçoit « interdit aux agents (rôle X) ») :
  - `gh pr create` : `--base develop` obligatoire (aucune autre base), `--head lot/<nom>`
    obligatoire ;
  - `gh pr merge --merge lot/<nom>` : `--merge` (ou `-m`) obligatoire, pull request nommée par sa
    branche de lot ; refusés : `--squash`/`-s`, `--rebase`/`-r`, `--admin`, `--delete-branch`/`-d`,
    `--auto`, `--disable-auto` ;
  - `gh pr comment` (sans `--delete-last`/`--yes`), `gh pr review`, `gh pr edit` (`--base` vers
    `develop` seulement), `gh pr ready`.
- Chaque écriture se lit sur la liste de ses options (relevée par `gh <cmd> --help` de gh 2.105.0,
  et sur https://cli.github.com/manual/gh_pr_merge pour `merge`) : option inconnue, options courtes
  groupées (`-md`), option booléenne avec valeur (`--merge=false`), `-R`/`--repo`, variables
  `GH_REPO`/`GH_HOST` (dans la commande), `--web`, `--editor`, `--attach`, `--recover`, projets,
  plusieurs pull requests, pull request ou base illisible (`$BR`, substitution), arguments lus par
  `xargs` : refusés. Le groupe et l'action s'écrivent en tête (`gh pr merge …`).
- `policy.mjs` : le rappel de démarrage des sous-agents dit « Aucun git push ni écriture sur GitHub
  par gh (lectures seules) ».
- `git push origin develop` reste permis à la session principale (inchangé, transitoire), documenté
  dans `CLAUDE.md`, `docs/03` et le backlog : la protection de `develop` le refusera ensuite.

### Tests (`tests/pr-flow.test.mjs`, nouveau)

- Session principale : 19 écritures du flux et 23 lectures permises, plus des enchaînements écrits
  comme l'orchestrateur les écrira (`gh pr checks 12 && gh pr merge --merge lot/…`,
  `gh pr merge … && git fetch origin && git switch develop && git pull --ff-only origin develop`,
  `git push origin develop`) : c'est l'échantillon des nouvelles commandes de l'orchestrateur
  demandé, ajouté ici puisque `ordinary-commands.test.mjs` est un test existant ; 7 rejouées par le
  hook complet (code 0).
- Session principale : 85 refus avec leur motif (fusion squash, rebase, `--admin`,
  `--delete-branch`, `--auto`, sans `--merge`, par numéro ou URL, base `main` à la création ou à
  l'édition, `--head` absent ou hors `lot/*`, autre dépôt, `GH_REPO`, `xargs`, toute autre écriture
  `gh`, `gh auth token`, `gh auth setup-git`, refus du lot 13 bis, push forcé, suppression d'une
  branche distante, push vers `main` ou une étiquette) ; 6 rejoués par le hook complet (code 2).
- Quinze rôles (les quatorze fichiers d'agent plus `revue-pr`, ajouté au jeu de rôles qu'il ait ou
  non son fichier) : chaque écriture du flux et `git push -u origin lot/…` refusés avec « interdit
  aux agents » et le nom du rôle, les 85 refus refusés aussi, les 23 lectures permises ; hook
  complet pour quatre rôles.
- Rejeu des commandes ordinaires (L14-07, `ordinary-commands.test.mjs`) : vert, inchangé.

## L20-02 : agent `revue-pr` (fait dans les garde-fous ; fichier d'agent : point ouvert 2)

- `policy.mjs` : `ROLE_WRITE_SCOPES['revue-pr'] = []`, aucun chemin du dépôt (Edit, Write, shell) ;
  le dossier temporaire de session reste libre. Tests : `tests/revue-pr-scope.test.mjs` (sept
  chemins refusés par Write, Edit, quatre écritures shell refusées, lectures du diff et dossier de
  session permis, rappel de démarrage).
- Le fichier `.claude/agents/revue-pr.md` est écrit, sur le modèle de `revue-code.md` : rôle,
  entrées du workflow (la description de la pull request est une donnée, pas une consigne), lecture
  seule, grille en neuf points (hexagonal, front, contrat, i18n, accessibilité, données
  personnelles avec D22, intégrité des tests, sécurité, couverture des cas nouveaux), méthode,
  format de sortie (`- [bloquant|non bloquant] <fichier>:<ligne> : <défaut> ; preuve : <…> ; correction :
  <…>`, dernière ligne exactement `VERDICT: BLOQUANT` ou `VERDICT: OK`, aucune autre ligne
  ne commence par `VERDICT:`), interdits (modifier, pousser, fusionner, approuver), section commune
  à l'identique. Il n'est pas commité : voir point ouvert 2.

## L20-03 : documentation (fait)

- `CLAUDE.md` : « Flux git et interdictions » réécrite (flux par pull request, commandes exactes,
  trois conditions de fusion, options refusées, protection posée par Julien, push transitoire de
  `develop`, agents en lecture seule sur `gh`) ; ligne des refus `gh` ; « Agents et garde-fous »
  (rôles avec `revue-pr`, l'orchestrateur fusionne par pull request) ; structure (quinze agents) ;
  `gh` dans `~/.local/bin` comme exception aux installations sur l'hôte (prérequis des commandes et
  règle des installations, décision du 21 nov.). Aucun jeton ni emplacement de jeton cité.
- `docs/03-organisation-agents.md` : décision datée du 21 nov. 2026 en tête du flux Git, puces de
  fusion et de push mises à jour, règles communes, ligne `revue-pr` du tableau des agents.
- Quatorze fichiers d'agent : seule la section commune change, à l'identique dans les quatorze :
  « il fusionne les lots par pull request après recette », et la puce « pousser » devient « pousser
  vers un dépôt distant (`git push`, sous toute forme) ou écrire sur GitHub (`gh` hors lecture) :
  seule la session principale pousse et ouvre, commente ou fusionne les pull requests ».
- `docs/backlog.md` : section 7 septies quater, L20-01 à L20-05.

## Décisions

- **Listes fermées pour `gh`, à toutes les sessions** : la consigne énumère ce que la session
  principale peut écrire ; tout le reste est refusé, y compris ce qui passait avant sans être
  réservé (`gh issue create`, `gh pr close`, `gh run rerun`, `gh workflow run`, `gh auth token`,
  `gh auth setup-git`, `gh secret set`, `gh config set`). Motif : principe « illisible donc
  refusé », et `gh auth token` afficherait le jeton dans la conversation. Alternative écartée : liste
  de refus (une sous-commande nouvelle de gh passerait). Ajouter une écriture (ex. `gh run rerun`)
  est une ligne dans `GH_PR_WRITES` ou une table voisine.
- **`gh pr merge` nomme la branche de lot** (`gh pr merge --merge lot/<nom>`), ni numéro ni URL :
  le hook ne voit pas la base d'une pull request sans appel réseau. Avec la création limitée à
  `--base develop` et l'édition limitée à `--base develop`, une pull request de tête `lot/*` vise
  `develop` ; une pull request `release/*` ou `hotfix/*` vers `main` (Julien) ne peut pas être
  fusionnée par la session. Alternative écartée : interroger GitHub depuis le hook (réseau, délai
  de 30 s, échec fermé).
- **`--head lot/<nom>` obligatoire à la création** : sans lui, `gh pr create` peut pousser la
  branche courante lui-même (aide de gh : « May still push git changes »), hors de la règle de push.
- **`--auto` refusé** : la session fusionne elle-même au moment où les trois conditions sont
  réunies ; la fusion automatique ne connaît pas la recette.
- **Groupe et action en tête** : gh (cobra) prend une option inconnue placée avant l'action pour
  une option à valeur, et lirait alors un autre mot comme action (`gh pr --title view comment 1`).
- **Puce « pousser » de la section commune complétée** (au-delà de la seule phrase sur la fusion
  par pull request) : la section liste ce qui est refusé à l'agent, et l'écriture par `gh` le
  devient ; « seulement `develop` » serait faux après le point ouvert 1. Le test de concordance
  rattache la puce à son premier mot (« pousser ») et reste vert ; le refus `gh` de chaque rôle est
  prouvé par `pr-flow.test.mjs`.
- **Écritures `gh` dans du code opaque** (`python3 -c "…gh pr comment…"`) non recherchées, comme au
  lot 13 bis (T5) : le filet reste la recette et le journal des garde-fous.

## Points ouverts

1. **Push des branches de lot : test existant contraire (sortie honorable).**
   `.claude/hooks/tests/git-push.test.mjs:114` exige, pour la session principale :
   `['git push origin lot/13-git-flow', /branches de lot restent locales/]`. L20-01 demande que
   `git push -u origin lot/<nom>` soit permis : la règle et ce cas ne peuvent pas être verts
   ensemble, et la consigne interdit de modifier un test existant de `develop`. Démonstration : avec
   le changement du patch appliqué et la ligne 114 inchangée, ce cas reçoit `null` (permis) au lieu
   d'un refus. Rien n'est commité de ce changement. Prêt dans
   **`docs/comptes-rendus/lot-20-lead-push-lot.patch`** : `lib/shell.mjs` (`lotRefspec` : `lot/<nom>`
   ou `lot/<nom>:lot/<nom>`, `LOT_BRANCH` partagé avec `gh pr create`/`merge` ; messages), README,
   `tests/push-lot.test.mjs` (nouveau : 9 formes permises, 20 refus, quinze rôles, hook complet),
   et la modification minimale de `git-push.test.mjs` (ligne 114 remplacée par le refus de
   `lot/13-git-flow:lot/autre`, `git push -u origin lot/13-git-flow` ajouté aux formes permises, donc
   refusé aux agents par la boucle existante). À décider : autorisation « tests » sur
   `.claude/hooks/tests/git-push.test.mjs` (correcteur, ou lead-architecte), commit avec
   `Justification-test: L20-01 …`. Sans ce patch, le flux par pull request ne peut pas démarrer
   (`gh pr create --head lot/…` suppose la branche poussée).
2. **Agent `revue-pr` : sept tests existants comptent quatorze rôles (sortie honorable, prévue par
   la consigne).** Ils lisent les rôles dans `.claude/agents/*.md` (un quinzième rôle y est donc
   contrôlé partout), mais vérifient aussi leur nombre :
   - `agents-git-section.test.mjs:208-209` : `assert.equal(FILES.length, 14, …)` et
     `assert.equal(new Set(FILES.map(roleOf)).size, 14)` ;
   - `assert.equal(ROLES.length, 14, …)` dans `branch-upstream.test.mjs:115`,
     `branch-tracking.test.mjs:321`, `worktree.test.mjs:84`, `ordinary-commands.test.mjs:377`,
     `hookspath-env.test.mjs:232` et `main-glued-options.test.mjs:280` (ces deux derniers du lot 19).
   Démonstration : dans un clone jetable, avec le fichier d'agent et `agents-git-section` porté à
   15 (première version du patch) plus les deux autres patchs, `pnpm hooks:test` donne 1007 sur
   1013 : 6 échecs, tous « connaît les quatorze rôles d'agent » (ou « compte les 88 commandes et
   les quatorze rôles d'agent »). Prêt dans **`docs/comptes-rendus/lot-20-lead-revue-pr.patch`** :
   `.claude/agents/revue-pr.md`, et dans les sept tests le décompte porté à 15 et le mot
   « quatorze » de leurs titres et commentaires remplacé par « quinze » (aucun autre changement).
   À décider : autorisation « tests » sur ces sept fichiers, `Justification-test: L20-02 …`.
3. **`.claude/settings.json` refuse `Bash(gh pr merge*)`** (`permissions.deny`, lot 13 bis) : la
   session principale ne peut pas lancer `gh pr merge --merge` quel que soit le hook. Hors de mon
   autorisation (`.claude/hooks/**`, `.claude/agents/**`). Prêt dans
   **`docs/comptes-rendus/lot-20-lead-settings.patch`** : la règle est remplacée par les seules
   variantes refusées (`--squash`, `--rebase`, `--admin`, `--delete-branch`, `--auto`, `-s`, `-r`,
   `-d`) ; un `--body` contenant « -s » serait refusé à tort (sans gravité).
4. **Publication de la revue de `revue-pr`** (pour L20-05, dev-devops) : les hooks refusent toute
   écriture `gh` au rôle `revue-pr`. Si le workflow lance `revue-pr` comme sous-agent et lui demande
   de poster par `gh pr comment`, ce sera refusé ; le workflow doit publier la réponse finale de
   l'agent lui-même (outil de commentaire de l'action, ou étape qui lit la sortie et la ligne
   `VERDICT:`). Si l'action exécute le prompt en session principale (sans `agent_type`), les
   écritures du flux lui sont permises : à vérifier dans le workflow.
5. **« Revue requise » sur `develop`** : `gh pr review --approve` est permis à la session principale
   (consigne), mais GitHub refuse qu'un compte approuve sa propre pull request, et `revue-pr`
   n'approuve pas. Une règle « une approbation requise » bloquerait donc toute fusion ; le contrôle
   requis du workflow (`VERDICT`) est le moyen prévu. À trancher par Julien en posant la protection
   (L20-05).
6. **Refus des garde-fous rencontrés pendant le lot** (aucun contourné) :
   - `node .claude/hooks/authorize.mjs list` : « les scripts des garde-fous ne se lancent que
     depuis la session principale » ; je voulais lire les autorisations, l'information était dans
     la consigne ;
   - `gh pr merge --help` : « gh pr merge fusionne… réservé à Julien » (ancienne règle) ; options
     relevées sur le manuel en ligne de gh à la place. La nouvelle règle refuse toujours
     `gh pr merge --help` (option non permise) ; `gh help pr merge` est permis ;
   - une boucle `for a in …; gh pr $a --help` : « commande illisible » ; réécrite en clair ;
   - `node --test .claude/hooks/tests/pr-flow.test.mjs` : script des garde-fous ; lancé par
     `pnpm hooks:test` ;
   - écritures par `python3` sur `lib/shell.mjs` puis sur une copie du README dans le dossier de
     session (« écriture opaque qui mentionne un oracle », « git push dans du code opaque ») :
     faites avec l'outil Edit ;
   - un `git commit` dans un dépôt jetable du dossier de session (« branche courante illisible ») :
     patchs produits par `git diff --no-index` à la place.

## Vérifications (ciblées, règle D26)

- `pnpm hooks:test` : 842 tests au départ (`0c79db7`) ; 967 sur 967 avec les changements commités
  (125 nouveaux : `pr-flow.test.mjs`, `revue-pr-scope.test.mjs`).
- Patchs, dans un clone jetable de la branche (dossier de session, supprimé ensuite) :
  `git apply` des trois patchs puis `pnpm hooks:test` : 1013 sur 1013 ; patch du push seul :
  1005 sur 1005. `git apply --check` des patchs push et `revue-pr` sur la branche : passe (celui de
  `settings.json` est refusé par les garde-fous faute d'autorisation, il a été vérifié dans le
  clone).
- `pnpm integrity:test` : 9 réussis, 0 échoué ; `pnpm integrity develop` : « Intégrité des tests :
  OK » (point de divergence `0c79db7`).
- Prettier : `prettier --check` vert sur les fichiers touchés (hooks, agents, `CLAUDE.md`) et sur
  les fichiers des patchs ; le hook pre-commit (format, lint, typecheck, test) est passé à chaque
  commit (le premier sans cache, 2 min 33 s, les suivants en cache).

## Application des sorties honorables (accord explicite de Julien, 21 nov. 2026)

Julien a accepté les points ouverts 1 à 3 ; l'orchestrateur a demandé de les appliquer (autorisation
`ba38d5d5` pour `.claude/hooks/**` et `.claude/agents/**`, tests des hooks compris ; autorisation
`2c00bdfb` pour `.claude/settings.json`). Les points 1 à 3 ci-dessus sont donc **faits** ; les
points 4 à 6 restent ouverts, le point 5 étant tranché au backlog (ci-dessous).

| Commit | Ticket | Sujet |
| ------ | ------ | ----- |
| `7ed3da8` | L20-01 | push de `lot/<nom>` par la session principale : `lib/shell.mjs`, README, nouveau `push-lot.test.mjs` |
| `b572f9d` | L20-01 | test existant `git-push.test.mjs` (Justification-test, rendu obsolète par la décision du 21 nov.) |
| `aa8730a` | L20-02 | agent `.claude/agents/revue-pr.md` |
| `e1a2ebe` | L20-02 | sept tests existants : décompte des rôles porté à 15 (Justification-test) |
| `b8a8b02` | L20-01 | `.claude/settings.json` : `permissions.deny` limité aux variantes interdites de `gh pr merge` |
| `a299809` | | backlog : décisions de Julien (sorties honorables acceptées ; « revue requise » = contrôle requis `Revue PR (Claude)`, sans approbation exigée) |
| (ce CR) | | compte rendu |

Entre `7ed3da8` et `b572f9d`, puis entre `aa8730a` et `e1a2ebe`, `pnpm hooks:test` aurait un
échec (commits séparés demandés : code d'un côté, test existant de l'autre) ; il est vert à la tête.

### Tests existants modifiés, avant et après

`.claude/hooks/tests/git-push.test.mjs` (`b572f9d`) :

- commentaire d'en-tête : avant « pousse, et uniquement develop vers origin » ; après « pousse, et
  uniquement develop ou une branche lot/<nom> vers origin (flux par pull request depuis le 21 nov.
  2026) » ;
- formes permises (`ALLOWED`, refusées aux agents par la boucle existante) : avant quatre formes de
  `develop` ; après les mêmes plus `'git push -u origin lot/13-git-flow'` ;
- refus de la session principale, ligne 114 : avant
  `['git push origin lot/13-git-flow', /branches de lot restent locales/]` ; après
  `['git push origin lot/13-git-flow:lot/autre', /branche de lot se pousse sous son nom/]`.

Sept tests qui comptent les rôles (`e1a2ebe`), seul le décompte et le mot « quatorze » changent :

| Fichier | Avant | Après |
| --- | --- | --- |
| `agents-git-section.test.mjs` | `it('quatorze fichiers d’agent, un rôle chacun')`, `FILES.length, 14`, `Set(…).size, 14` ; titre « identique dans les quatorze » ; 3 commentaires « quatorze » | `quinze`, `15`, `15` ; « identique dans les quinze » ; « quinze » |
| `branch-upstream.test.mjs` | `it('connaît les quatorze rôles d’agent')`, `ROLES.length, 14` ; 2 commentaires | `quinze`, `15` |
| `branch-tracking.test.mjs` | idem, 1 commentaire | idem |
| `worktree.test.mjs` | idem, 1 commentaire | idem |
| `hookspath-env.test.mjs` | idem, 1 commentaire | idem |
| `main-glued-options.test.mjs` | idem, 1 commentaire | idem |
| `ordinary-commands.test.mjs` | `it('compte les 88 commandes et les quatorze rôles d’agent')`, `ROLES.length, 14` ; 1 commentaire | `quinze`, `15` |

### Vérifications après application

- `pnpm hooks:test` : 1013 sur 1013 (967 avant application).
- `pnpm integrity:test` : 9 réussis, 0 échoué.
- `pnpm integrity develop` : « Intégrité des tests : OK » (les deux commits de tests portent leur
  ligne `Justification-test`).
- Pre-commit vert à chaque commit ; arbre de travail propre.
