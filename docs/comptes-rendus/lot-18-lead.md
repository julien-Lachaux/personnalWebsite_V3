# Lot 18 : suites de la recette du lot 14 (lead-architecte)

Date : 20-21 nov. 2026. Branche `lot/18-suites-lot-14` (depuis `develop` à `ec5a30c`), worktree
`.claude/worktrees/lot-18-suites`, isolation `siteperso-v3-lot18` (ports 5782 à 5785). Tickets
L18-01 et L18-02 (`docs/backlog.md`, 7 septies bis). Autorisation « config » `b058c66e`
(`.claude/hooks/**`, `.claude/agents/**`). Aucun test existant modifié, rien poussé, aucun worktree
géré.

## Commits

| Commit    | Ticket | Sujet |
| --------- | ------ | ----- |
| `e4c060a` | L18-01 | lectures de `git config` permises, `core.hooksPath` compris ; tests `config-read.test.mjs` |
| `99362f5` | L18-02 | création d'une branche suivie refusée aux agents ; tests `branch-tracking.test.mjs` |
| `bb48adc` | les deux | README des garde-fous |
| `6ce107d` | les deux | CLAUDE.md, « Flux git et interdictions » |
| (ce CR)   |        | compte rendu |

Les commits qui touchent `.claude/hooks/` portent `Justification-test: L18-0x …`.

## L18-01 : lectures de git config (fait)

Cause : dans `lib/shell.mjs`, cas `config`, le refus « changer core.hooksPath » tombait sur tout
mot `core.hooksPath`, avant de savoir s'il s'agissait d'une lecture. Le refus de l'alias de push
avait le même défaut (`git config --get alias.p push` refusé).

Correctif : `gitConfigWrite` lit les options à leur place. Les valeurs de `--file`, `--blob`,
`--type`, `--default`, `--comment`, `--value` ne sont pas prises pour des actions. Une lecture se
reconnaît à une action écrite en entier (`--get`, `--get-all`, `--get-regexp`, `--get-urlmatch`,
`--get-color`, `--get-colorbool`, `-l`, `--list`), aux sous-commandes `get` et `list`, ou à
l'absence de valeur (`git config <clé>`). Un mot qui peut abréger une action d'écriture (`--unset-a`,
`--un`, `--re`) compte comme écriture. Les refus de `core.hooksPath` et de l'alias de push ne
portent plus que sur les écritures.

Écritures toujours refusées, ou refusées en plus :
- refusées comme avant : `core.hooksPath` sous toutes les formes (`set`, `unset`, `--add`,
  `--replace-all`, `--unset[-all]`, `--global`, `-f`, `-c core.hooksPath=`), et les clés et sections
  de destination ;
- nouveau refus : retirer ou renommer la section `core` (`--remove-section core`,
  `rename-section core …`), qui retire `core.hooksPath` et était permis ;
- nouveau refus : `git config --comment --get <clé> <valeur>`, une écriture que l'ancien code
  prenait pour une lecture, sur les clés de destination comme sur `core.hooksPath`.

Avant et après : le nouveau fichier lancé sur le code de `develop` donne 4 échecs sur 6. Le premier
est `main : git config --get core.hooksPath`, refusé avec « changer core.hooksPath désactive le hook
pre-commit ». Les autres sont `--remove-section core` permis et `--comment --get remote.origin.url …`
permis. Sur le code du lot, 6 sur 6.

## L18-02 : création d'une branche suivie (fait, sauf la puce des agents)

### Comportement réel de git, mesuré dans des dépôts jetables

Montage : un dépôt amont avec `develop` et `feat`, cloné (`origin/develop`, `origin/feat`). J'ai
relevé `git config --get-regexp ^branch\.` après chaque forme, sur git 2.30.2 (hôte) et sur 2.43.0
(image `mcr.microsoft.com/playwright:v1.65.1-noble`). Scripts dans le dossier de session.

| Forme | Effet sur la branche suivie |
| --- | --- |
| `branch a origin/develop`, `refs/remotes/…`, `remotes/…`, `origin`, `origin/HEAD`, `@{u}` | suit `origin/develop` |
| `branch a develop`, `checkout -b a`, `switch -c a`, `checkout -b a develop` | rien (`autoSetupMerge=true`, départ local) |
| `branch --track a develop`, `--t`, `--tr`, `-ft` | suit `.` (local) : `--track` écrit toujours |
| `--track=direct` / `--track=inherit` | erreur 129 en 2.30, suit en 2.43 |
| `checkout -tb a origin/develop` | suit en 2.30, erreur 129 en 2.43 (`-t` prend une valeur) |
| `branch a origin/develop~0`, `HEAD~0` | rien (pas une branche) |
| `branch -f lot origin/feat`, `checkout -B lot origin/feat`, `switch -C …` (branche existante) | suit |
| `branch -c develop a` (copie) | copie le suivi ; `branch -m` le garde (renommage, non refusé) |
| `checkout feat`, `checkout feat --`, `switch feat` (devinée), `worktree add ../x feat` | suit `origin/feat` |
| `checkout --no-guess feat`, `-c checkout.guess=false`, `checkout --no-track feat` | échec, rien |
| `worktree add ../feat` sans `--guess-remote` | crée `feat` depuis HEAD, ne suit rien |
| `worktree add --guess-remote ../feat`, `--guess` | suit `origin/feat` |
| `worktree add -b lot/x ../w develop` (forme de l'orchestrateur) | rien |
| `-c branch.autoSetupMerge=always branch a develop`, `… checkout -b a` | suit `.` |
| `-c branch.autoSetupMerge=inherit` : `branch a <suivie>`, `checkout -b a` (HEAD suivi) | erreur en 2.30, copie l'amont en 2.43 ; rien depuis une distante ou une branche sans amont |
| `-c branch.autoSetupMerge=simple branch feat origin/feat` | erreur en 2.30, suit en 2.43 ; rien pour un autre nom |
| `-c branch.autoSetupRebase=always branch a origin/develop` | suit, plus `branch.a.rebase true` |
| `fetch --set-upstream origin feat`, `--set-up`, `--set`, `pull --set-u` | écrit l'amont de la branche courante |
| `--no-track`, `--no-t`, `--track --no-track` | rien (le dernier des deux l'emporte) |
| `GIT_CONFIG_COUNT=…` | ignoré par git 2.30 (apparu en 2.31) ; `GIT_CONFIG_PARAMETERS` agit en 2.30 |

### Règle appliquée (`lib/shell.mjs`, rôle autre que `main`)

L'agent est refusé quand git écrirait `branch.<branche>.remote`. Le motif est « créer une branche qui
suit une autre branche écrit branch.<branche>.remote, hors de la règle des destinations de push :
interdit aux agents », suivi de « --no-track reste permis ». Il est refusé :
- pour un `--track` explicite de `branch`, `checkout`, `switch` et `worktree add` (formes du tableau,
  groupes d'options courtes compris), quel que soit le point de départ ;
- quand le suivi automatique s'applique :
  - le mode vient de `branch.autoSetupMerge`, lu dans `-c` puis par `git -C <dépôt> config --get` ;
  - le point de départ est classé par `git rev-parse --verify -q --symbolic-full-name`. Un nom
    absent qui commence par un remote du dépôt compte comme distant (`git fetch && git checkout -b a
    origin/nouvelle`) ;
  - un mode inconnu, une variable `GIT_CONFIG*` ou un dépôt illisible donne un refus ;
- quand une branche distante est devinée et que le nom n'est pas une révision locale. Un dépôt
  illisible donne aussi un refus ;
- pour la copie d'une branche qui a un amont (ou d'une branche illisible) ;
- pour `fetch` et `pull` avec `--set-upstream` et ses abréviations.

Écrire `branch.autoSetupMerge` ou `branch.autoSetupRebase` rejoint `DESTINATION_KEY`. C'est refusé à
toutes les sessions, comme les autres clés de destination.

### Tests (`branch-tracking.test.mjs`, nouveau)

- Rejeu réel :
  - git rejoue chacune des 58 formes refusées dans un clone neuf, et chacune écrit une branche
    suivie ;
  - les formes que la version locale de git rejette sont marquées `mayFail` : elles ne doivent alors
    rien écrire ;
  - les 50 formes permises n'écrivent rien ;
  - `always` et `worktree.guessRemote` sont testés dans la configuration du dépôt.
- Refus pour les quatorze rôles par l'analyse de la commande : les 58 formes, plus 16 formes
  composées ou illisibles (alias, `bash -c`, `if`, sous-shell, `-C`, `cd "$D"`, `$START`,
  `GIT_CONFIG_COUNT`, `--track` seul, valeur inconnue).
- Hook complet pour dev-api.
- Formes permises vérifiées pour quatre rôles et par le hook.
- Session principale : chaque forme refusée aux agents lui est permise, par l'analyse et par le
  hook, ainsi que `git worktree add -b lot/x <dossier> develop`, y compris dans un dépôt réglé sur
  `always`.
- `branch.autoSetupMerge` et `branch.autoSetupRebase` : écritures refusées à tous, lectures
  permises.
- Le test isole la configuration : HOME neutre et `GIT_CONFIG_NOSYSTEM`.

Avant et après : ce fichier lancé sur `e4c060a` (code d'avant L18-02, clone jetable) donne 17 échecs
sur 24 : les quatorze rôles, le hook dev-api, la configuration du dépôt et l'écriture de
`autoSetupMerge`. Le rejeu réel, les formes permises et la session principale passent. Sur
`99362f5`, 24 sur 24.

## Commandes ordinaires (point 3)

- `ordinary-commands.test.mjs` (L14-07) reste vert. Il rejoue les 88 commandes de l'orchestrateur
  et l'échantillon de commandes d'agent, dont `git checkout develop`, `git switch develop`,
  `git fetch origin` et `git pull --ff-only origin develop`.
- `branch-upstream.test.mjs`, `main-branch.test.mjs`, `main-commit.test.mjs`, `worktree.test.mjs`
  et `agents-git-section.test.mjs` restent verts.
- La session principale n'a aucun nouveau refus de travail courant. Les refus ajoutés pour elle sont
  des écritures de configuration : `branch.autoSetup*`, section `core`, `--comment --get` en
  écriture.
- `git worktree add -b lot/x <dossier> develop` lui reste permis. Il l'est aussi aux agents avec la
  configuration par défaut (départ local).

## Preuves

| Critère | Commande | Résultat |
| --- | --- | --- |
| Tests des garde-fous | `pnpm hooks:test` | 798 tests, 798 verts (768 sur `develop`, + 6 L18-01, + 24 L18-02) |
| Tests du script d'intégrité | `pnpm integrity:test` | 19, 3, 13, 8, 95, 13, 13, 12, 8, 9 réussis, 0 échec |
| Intégrité depuis la base | `pnpm integrity develop` | « Intégrité des tests : OK » |
| Avant/après L18-01 | `pnpm hooks:test` avec le nouveau fichier, code de `develop` | 4 échecs, puis 0 |
| Avant/après L18-02 | clone jetable sur `e4c060a` + nouveau fichier, `pnpm hooks:test` | 17 échecs, puis 0 |
| Comportement de git | scripts du dossier de session, git 2.30.2 et 2.43.0 | tableau ci-dessus |
| Formatage | `pnpm format` | aucun fichier modifié |
| `pnpm check` final | `TURBO_FORCE=true pnpm check` | **non fait, en attente**, voir le point ouvert 1 |

## Décisions

1. **Ce qui est refusé, c'est l'écriture du suivi, pas seulement la distante.** Est refusée toute
   création où git écrit `branch.<x>.remote`, y compris `remote = .` (`--track` depuis une branche
   locale, `always`). Motif : L14-17 vise l'écriture de `branch.*.remote`, et le ticket demande de
   refuser `--track` explicite sans condition. Alternative écartée : ne refuser que les points de
   départ distants, ce qui laisse `--track` local.
2. **Lire `branch.autoSetupMerge` plutôt que supposer le défaut.** Alternatives écartées :
   - supposer `true` : manque un réglage `always` ou `inherit` posé par Julien ;
   - refuser toute création avec point de départ : casse `git checkout -b a develop`.
3. **Formes ajoutées au-delà de la lettre du ticket.** Ce sont la branche devinée, la copie d'une
   branche suivie, `fetch` et `pull --set-upstream`, et `worktree add`. Motif : même effet
   (`branch.*.remote` écrit), constaté sur git. Alternative écartée : les laisser en point ouvert,
   ce qui laisse une écriture du suivi ouverte aux agents.
4. **`branch.autoSetupMerge` et `branch.autoSetupRebase` refusés en écriture à toutes les
   sessions.** Motif : ce sont des clés de la même famille que `branch.*.remote`, et ces clés sont
   refusées à tous depuis le lot 13 bis. Leur écriture est une configuration durable, réservée à
   Julien. Alternative écartée : un refus aux agents seulement. Les commandes de création de
   branche restent à la session principale, comme demandé.
5. **Ce qui est illisible est refusé.**
   - `cd "$D" && git checkout <nom>` devient refusé aux agents, car la branche devinée ne se vérifie
     pas. Il était permis.
   - `GIT_CONFIG*` dans la commande rend le mode de suivi illisible.
6. **Motif faible.** Le refus de suivi ne remplace pas un refus déjà posé, plus précis (écriture de
   `main`, `-u` de L14-17). Les messages des tests existants restent donc inchangés.

## Non fait : puce de la section « Git et garde-fous » (sortie honorable)

Je n'ai pas ajouté la puce demandée : le test de concordance existant (`agents-git-section.test.mjs`,
sur `develop`) l'interdit sans être modifié. Son test « chaque refus déclaré a ses commandes de
contrôle, et réciproquement » compare le premier mot de chaque puce aux clés de `PROBES`, à
l'égalité exacte :
- une puce nouvelle ajoute une clé ;
- une puce qui reprend un premier mot existant le duplique.

Dans les deux cas le test échoue tant que `PROBES` n'est pas modifié. Un nouveau fichier de test ne
peut pas lever cette assertion.

Démonstration, dans un clone jetable à `99362f5`, avec la puce ajoutée aux quatorze fichiers et
`pnpm hooks:test` : 798 tests, 1 échec.

```
✖ chaque refus déclaré a ses commandes de contrôle, et réciproquement
  + actual - expected
    [ 'contourner', +'créer', 'définir', 'fusionner', 'lancer', 'pousser', 'publier', … ]
```

Avec en plus la clé `créer` dans `PROBES` du même clone : 798 sur 798, y compris L14-14 : section
identique, aucun terme interne, refus effectifs pour les quatorze rôles. Proposition prête à
appliquer, sous une autorisation « tests » pour `agents-git-section.test.mjs` :

- dans les quatorze `.claude/agents/*.md`, après la puce « définir » :

  ```
  - créer une branche qui suit une autre branche (`git branch --track`, `checkout -b` ou `switch -c`
    depuis une branche distante, `fetch --set-upstream`) : la destination des push est réservée à la
    session principale ; `--no-track` reste permis ;
  ```

- dans `PROBES`, avant `utiliser` (dépôt du test sans remote, d'où des formes refusées sans
  branche distante) :

  ```js
  créer: [
    bash('git branch --track lot/y develop'),
    bash('git checkout -b lot/y --track develop'),
    bash('git switch -c lot/y --track develop'),
    bash('git -c branch.autoSetupMerge=always branch lot/y develop'),
    bash('git fetch --set-upstream origin develop'),
  ],
  ```

Alternative sans toucher au test : élargir la puce « définir » existante, par exemple « définir la
branche suivie d'une branche ou créer une branche qui suit une autre branche (`git branch -u`,
`--set-upstream-to`, `--track`, `checkout -b` ou `switch -c` depuis une branche distante) : … ». Un
nouveau fichier contrôlerait alors ces formes. Ce n'est pas « une puce » comme demandé : à trancher
par l'orchestrateur.

## Points ouverts

1. **`pnpm check` final non lancé.** Je l'ai démarré (`pnpm db:down`, puis
   `TURBO_FORCE=true pnpm check`) avant de recevoir la consigne de coordination de la charge
   machine. Je l'ai arrêté pendant `hooks:test`, avant turbo et les conteneurs. L'échec
   « Promise resolution is still pending » de `branch-tracking.test.mjs` dans ce journal vient de
   cette interruption. Je n'ai pas d'outil pour écrire à la session principale, donc je n'ai pas pu
   demander le « vas-y ».
   - À lancer sur feu vert, dans le worktree : `pnpm db:down`, `TURBO_FORCE=true pnpm check`,
     `pnpm db:down`.
   - Aucun processus ni conteneur du lot ne reste.
   - Le code applicatif n'est pas touché : seuls `.claude/hooks/`, `CLAUDE.md` et ce compte rendu
     changent.
2. **Section des agents** : voir « Non fait » ci-dessus.
3. **Écart L14-06 lu dans le code, non mesuré.** `checkout` et `switch` ne lisent le nom créé que par
   `valueOf(['-b', …])`, en mot séparé. `git checkout -qb main`, `-bmain`, `switch -cmain` et
   `--cr main` ne passent donc pas par `writesRef` (création de `main`). Le parseur `creationWords`
   du lot les lit : on pourrait le brancher sur `writesRef`. Je ne l'ai pas fait : hors ticket, et je
   n'ai pas tenté la commande pour le vérifier.
4. **Écart lu dans le code, non mesuré.** `core.hooksPath` passé par l'environnement
   (`GIT_CONFIG_PARAMETERS="'core.hooksPath=…'"`, `GIT_CONFIG_COUNT/KEY/VALUE`) n'est pas lu.
   Seul `-c` l'est (`configValue`). Même famille que `-c core.hooksPath=` : on pourrait refuser à
   tous une variable `GIT_CONFIG*` qui nomme `core.hooksPath`, ou toute variable illisible.
5. **Limites connues de L18-02.**
   - `checkout.guess` et `worktree.guessRemote` : `checkout.guess` n'est lu que dans `-c`. Sa valeur
     dans un fichier n'est pas lue, ce qui est plus strict.
   - Un point de départ créé plus haut dans la même commande compte comme « inconnu » : refusé en
     `always` ou `inherit`, permis en `true`, sauf s'il a l'allure d'une distante.
   - `HEAD` est lu dans le dépôt, pas suivi à travers un `checkout` de la même commande.
   - Les abréviations de `--copy` ne sont pas lues.
   - Les noms de remote qui contiennent `/` ne sont pas gérés.
   - Une analyse de création de branche lance jusqu'à cinq lectures git.
6. **Hooks de cette session = code de `develop`.** Jusqu'à la fusion, L18-01 n'est pas effectif pour
   les sessions en cours. Ma lecture `git config --get core.hooksPath`, faite dans un clone du
   dossier de session pour une vérification en direct, a été refusée avec l'ancien motif. C'est le
   faux positif corrigé. Je ne l'ai pas retentée.
7. **Refus rencontrés et respectés.**
   - Un script `sh` du dossier de session contenait le texte `git stash push`, lu comme un push
     caché : j'ai retiré ce cas.
   - Un script écrit et lancé par la même commande : je l'ai écrit d'abord, lancé ensuite.
   - `node --test` sur un fichier des garde-fous : remplacé par `pnpm hooks:test`.
   - Une édition de `lib/shell.mjs` par `python3` : remplacée par l'outil Edit.
   - La lecture `git config --get core.hooksPath` du point 6.
