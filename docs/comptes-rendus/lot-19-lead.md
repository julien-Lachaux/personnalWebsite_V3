# Lot 19 : garde-fous et charge machine (lead-architecte)

Date : 21 nov. 2026. Branche `lot/19-garde-fous-charge` (depuis `develop` à `e105c63`), worktree
`.claude/worktrees/lot-19`, isolation `siteperso-v3-lot19` (ports 5792 à 5795). Tickets L19-01 à
L19-03 (`docs/backlog.md`, 7 septies ter), puis L19-04 ajouté en cours de lot par l'orchestrateur.
Autorisation « config » `df511efa` (`.claude/hooks/**`, `.claude/agents/**`, `turbo.json`,
`apps/api/vitest.config.ts`). Aucun test existant modifié : deux fichiers de test créés. Rien
poussé, aucun worktree géré, pas de `pnpm check` (consigne, puis règle D26).

## Commits

| Commit    | Ticket | Sujet |
| --------- | ------ | ----- |
| `ae9815c` | L19-01 | création de `main` par options collées et formes voisines refusée à toutes les sessions ; `main-glued-options.test.mjs` |
| `25b6764` | L19-02 | `core.hooksPath` par l'environnement de git refusé à toutes les sessions ; `hookspath-env.test.mjs` |
| `fb222ca` | L19-03 | `TEST_MAX_WORKERS` : `apps/api/vitest.config.ts`, `turbo.json` |
| `f7cd2f2` | L19-03 | documentation : `CLAUDE.md` (« Worktrees en parallèle »), `.env.example` |
| `f4dcca9` | L19-01, L19-02 | README des garde-fous |
| `bda58d8` | L19-04 | règle D26 : backlog, `CLAUDE.md`, dix fichiers d'agent |
| (ce CR)   |        | compte rendu |

Les commits qui touchent `.claude/hooks/`, `.claude/agents/`, `turbo.json` ou
`apps/api/vitest.config.ts` portent `Justification-test: L19-0x …`.

## L19-01 : création ou écriture de `main` par options collées (fait)

### Comportement réel de git, mesuré

Montage : un amont avec `main` et `develop` (HEAD sur `develop`), cloné : seule `develop` est locale,
`origin/main` existe. Une forme par clone neuf ; relevé de `refs/heads/main` et de la HEAD. Mesuré
sur git 2.30.2 (hôte) et 2.43.0 (image `mcr.microsoft.com/playwright:v1.65.1-noble`). Scripts :
dossier de session (`main-forms.mjs`, `forms.json`).

| Forme | Effet |
| --- | --- |
| `checkout -qb main`, `-bmain`, `-qbmain`, `-fbmain`, `-Bmain`, `-qBmain develop` | crée main |
| `checkout --or main`, `--orp main`, `--orphan=main` | HEAD sur main (née au premier commit) ; `--o` ambigu, échec |
| `checkout -qt origin/main`, `--tr origin/main`, `-t remotes/origin/main`, `-t refs/remotes/origin/main` | crée main |
| `checkout -tq origin/main` | crée main en 2.30 ; échec en 2.43 (`-t` prend une valeur) |
| `checkout --track=direct origin/main` | échec en 2.30 ; crée main en 2.43 |
| `checkout main`, `checkout -q main`, `checkout main --` | crée main (branche distante devinée) |
| `checkout --no-guess main`, `--no-g`, `-c checkout.guess=false checkout main` | échec, rien |
| `switch -cmain`, `-qcmain`, `-Cmain`, `--cr main`, `--cre=main`, `--create=main`, `--force-c main`, `--force-create=main` | crée main |
| `switch --or main`, `--orp main`, `--orphan=main` | HEAD sur main |
| `switch -qt origin/main`, `--tr origin/main`, `switch main`, `switch -q main` | crée main |
| `worktree add -bmain ../w`, `-fbmain`, `-qbmain`, `-Bmain ../w develop` | crée main |
| `worktree add ../main`, `worktree add ../w main`, `--guess-remote ../main` | crée main (nom du dossier, ou distante devinée) |
| `worktree add --orphan ../main`, `--orphan -b main ../w` | inconnu en 2.30 ; HEAD du worktree sur main en 2.43 |
| `worktree add --detach ../main`, `-d ../main` | rien |
| `branch --cop develop main`, `branch --mo lot/y main` | écrit main ; `--co` ambigu (`--copy`, `--column`) |
| `checkout -qb lot/z`, `-blot/z`, `switch -qc lot/z`, `worktree add -b lot/x2 ../w develop` | rien sur main |

### Règle appliquée (`lib/shell.mjs`, toutes les sessions)

- `checkout`, `switch` et `worktree add` lisent le nom créé par le lecteur d'options du lot 18
  (`creationWords`), pour toutes les sessions et plus seulement pour la règle de suivi des agents.
  Le lecteur prend la suite d'un groupe d'options courtes comme valeur, quels qu'en soient les
  caractères (`-qblot/x` était ignoré avant). Les options longues abrégées sont lues :
  `--orphan` dès `--or`, `--create` dès `--cr`, `--force-create` dès `--force-`.
- `--track` sans `-b` est lu par `trackOption` (groupes, abréviations), en plus de l'ancienne
  lecture exacte ; le nom créé suit la règle de git (`refs/`, puis `remotes/`, puis le remote
  retirés), d'où `-t remotes/origin/main` reconnu.
- Branche distante devinée : `checkout main` et `switch main` sont refusés quand `main` n'est pas
  une révision locale et qu'un remote la porte (sauf `--no-guess`, `--detach`, `-p`,
  `-c checkout.guess=false`) ; `worktree add <dossier>` dont le nom est `main`, absente en local,
  `--orphan` compris, et `worktree add <dossier> main` quand `main` est devinée. Une `main` locale
  existante reste permise : on y passe sans l'écrire.
- `git branch` : `--delete`, `--move`, `--copy` abrégés (`--de`, `--mo`, `--cop`).
- Illisible donc refusé : une option dont le nom est calculé (`-$X`, `--$X`) ou une valeur collée
  calculée (`-qb"$NOM"`, `--cr="$NOM"`), un dossier calculé sans point de départ
  (`worktree add "$D"`).

### Tests (`main-glued-options.test.mjs`, nouveau)

- Rejeu réel : les 44 formes refusées, chacune dans un clone neuf, créent `main` ou placent une HEAD
  dessus (`mayFail` pour les quatre formes que la version locale de git rejette, qui ne doivent alors
  rien écrire) ; les 21 formes permises n'écrivent rien ; dans un clone où `main` existe en local,
  les cinq passages permis ne la déplacent pas.
- Refus pour la session principale et les quatorze rôles par l'analyse de la commande : les 44
  formes, plus 14 formes illisibles ou composées (sous-shell, `bash -c`, `-C .`, `&& git commit`) ;
  hook complet pour `main` et `dev-api`.
- Formes permises vérifiées pour cinq rôles et par le hook, dont `git checkout -qb lot/x`, et
  `git worktree add -b lot/x <dossier> develop` à la session principale, avec ou sans `main` locale.

Avant et après : le fichier lancé sur le code de `develop` (avant toute modification de
`lib/shell.mjs`) donne 16 échecs (les quinze rôles et le hook) ; le rejeu réel y passe déjà, ce qui
confirme le comportement de git. Après, 0 échec.

## L19-02 : `core.hooksPath` par l'environnement (fait)

### Comportement réel de git, mesuré

Dépôt jetable dont la configuration locale fixe `core.hooksPath` à une valeur neutre (comme husky),
relevé de `git config --get core.hooksPath` après chaque forme (script `hookspath-env.sh` du dossier
de session) :

| Forme | 2.30.2 | 2.43.0 |
| --- | --- | --- |
| `GIT_CONFIG_PARAMETERS="'core.hooksPath=/autre'"` (casse quelconque) | change | change |
| `GIT_CONFIG_PARAMETERS="'core.hooksPath'='/autre'"` | erreur de format | change |
| `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=…`, par `export`, `env` | ignoré | change |
| `GIT_CONFIG_KEY_0=… GIT_CONFIG_VALUE_0=…` sans `GIT_CONFIG_COUNT` | ignoré | ignoré |
| `git -c include.path=<fichier>`, `-c includeIf.gitdir:/.path=<fichier>` | change | change |
| `include.path` par `GIT_CONFIG_PARAMETERS` | change | change |
| `include.path` par `GIT_CONFIG_COUNT` | ignoré | change |
| `X=/autre git --config-env=core.hooksPath=X` | option inconnue | change |
| `GIT_CONFIG_GLOBAL=<fichier>`, `GIT_CONFIG_SYSTEM=<fichier>` | valeur locale | valeur locale |

### Règle appliquée (toutes les sessions)

- Refusés : `GIT_CONFIG_PARAMETERS` qui nomme `core.hooksPath` ou une clé `include*`, et
  `GIT_CONFIG_KEY_<n>` qui vaut l'une d'elles, en tête de commande, par `env`, `export`,
  `declare -x`, une affectation exportée plus loin ou une valeur résolue (`K=…; …=$K`).
- Formes voisines au même effet : `-c include.path=` et `-c includeIf.*.path=`, `--config-env`
  collé ou séparé sur `core.hooksPath` ou `include*`.
- Illisible donc refusé : valeur calculée de `GIT_CONFIG_PARAMETERS`, `GIT_CONFIG_COUNT`,
  `GIT_CONFIG_KEY_<n>` ou `GIT_CONFIG_VALUE_<n>` (dont `+=`, `read`, `printf -v`, `declare -n` vers
  l'une d'elles), clé `-c` ou `--config-env` calculée (`git -c "$KV"`).
- Permis : `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_SYSTEM`, `GIT_CONFIG_NOSYSTEM` (ils passent après la
  configuration locale), et toute autre clé lisible (`GIT_CONFIG_COUNT=1
  GIT_CONFIG_KEY_0=user.name …`, `-c core.quotepath=false`).

### Tests (`hookspath-env.test.mjs`, nouveau)

- Rejeu réel par bash : les 26 gabarits refusés changent `core.hooksPath` quand git les connaît
  (`mayFail` pour git < 2.31 ou < 2.32 et pour `-c` collé, que git rejette mais que l'analyse refuse,
  lu comme `-c` séparé depuis T4) ; les 10 gabarits permis laissent la valeur locale.
- Refus pour la session principale et les quatorze rôles : chaque gabarit devant `git commit` et
  devant `git config --get`, plus 15 formes illisibles ; hook complet pour `main` et `dev-api`.
- Formes permises pour cinq rôles et par le hook.

Avant et après : sur le code de `develop`, 16 échecs d'analyse (quinze rôles et hook) ; 0 après.
Deux défauts du test lui-même, vus au premier passage et corrigés avant tout commit : `-c` collé
rejeté par git (marqué `mayFail`) et sortie de `git status` mêlée à la sonde (`--short`).

### Hors de la lettre du ticket, ajouté

`include.path`, `includeIf.*.path` et `--config-env` : même effet mesuré que `-c core.hooksPath=`.
Alternative écartée : les laisser en point ouvert, ce qui laissait le hook pre-commit désactivable par
un fichier inclus.

## L19-03 : borne des processus Vitest (fait, mesure à faire)

- Variable **`TEST_MAX_WORKERS`** (entier positif ou pourcentage de 1 à 100 %), lue par
  `apps/api/vitest.config.ts` dans l'environnement puis dans le `.env` racine du worktree (déjà
  chargé par `process.loadEnvFile`, l'environnement l'emporte). Elle fixe `test.maxWorkers` à la
  racine de la configuration, donc pour les projets `unit` et `e2e` ensemble ; une valeur invalide
  arrête Vitest avec un message ; sans valeur (absente ou vide), rien n'est ajouté à la
  configuration : défaut de Vitest (cœurs moins un), en CI comprise. Ignorée sous Stryker.
- `turbo.json` : `passThroughEnv: ["TEST_MAX_WORKERS"]` sur `test`, `test:e2e` et `test:coverage`
  (documenté pour Turborepo 2.11.13 : `schema.json`, `docs/.../using-environment-variables.mdx` ;
  « available … without including them in the hash »). En mode strict, une valeur passée dans
  l'environnement de `pnpm check` ou `pnpm test:e2e` atteint donc Vitest.
- Documentation : `CLAUDE.md` (« Worktrees en parallèle », paragraphe « Charge machine »),
  `.env.example` (ligne commentée `# TEST_MAX_WORKERS=4`).

### Mesure

**À faire** : l'orchestrateur a suspendu toute tâche lourde (session front en `pnpm check`). Les
deux mesures des e2e de l'API seuls, sans et avec la borne à 4, restent à lancer :

```sh
pnpm db:test:up
pnpm --filter @siteperso/api test:e2e                       # sans borne
TEST_MAX_WORKERS=4 pnpm --filter @siteperso/api test:e2e    # borne à 4
pnpm db:down
```

Ces deux commandes servent aussi de preuve de l'effet de la borne : Vitest affiche le nombre de
processus lancés. Référence du lot 14 (même machine, 16 cœurs) : 15 processus, 19 à 27 s ;
4 processus, 35 s.

### Décisions

1. **Nom propre au projet plutôt que `VITEST_MAX_WORKERS`.** Vitest 5.1.1 lit `VITEST_MAX_WORKERS`
   après les options passées en ligne (`index.ER9afepi.js`, l. 9156) : dans le `.env` racine, elle
   remplacerait le `maxWorkers: 1` que le lanceur Stryker passe à Vitest
   (`vitest-test-runner.js`, l. 107). `TEST_MAX_WORKERS` n'agit que par la configuration, que
   `--maxWorkers` et Stryker remplacent.
2. **Une seule borne pour les deux projets**, à la racine : Vitest refuse deux `maxWorkers`
   différents dans un même groupe (L14-15) ; un groupe par projet aurait séparé unitaires et e2e
   dans `test:coverage`.
3. **`passThroughEnv` plutôt que `env`** : le nombre de processus ne change pas les sorties, il ne
   doit pas invalider le cache de `test`.

## L19-04 : règle D26, une seule vérification complète par lot (fait)

- `docs/backlog.md` : ticket L19-04 ajouté dans « 7 septies ter », avec le texte de la décision.
- `CLAUDE.md` :
  - la phrase « les e2e doivent aussi passer avant de livrer un lot (`pnpm check`) » devient « les
    e2e des fichiers touchés … (vérifications ciblées, règle D26) » ;
  - une puce « Une seule vérification complète par lot » reprend la règle ;
  - « Worktrees en parallèle » : l'isolation vaut pour toute vérification simultanée (recette ou
    vérifications ciblées), plus seulement pour deux `pnpm check` ;
  - la ligne `pnpm check` des commandes précise qu'il est lancé une fois par lot, par la recette.
- Fichiers d'agent, « Méthode » et « Terminé quand » : `dev-api`, `dev-sql`, `dev-contrats`,
  `dev-devops`, `dev-front`, `correcteur` (description du frontmatter comprise), `lead-architecte`,
  `qa`, `qa-front` passent aux vérifications ciblées ; `chef-de-projet` : la recette porte l'unique
  `TURBO_FORCE=true pnpm check`. La section commune « Git et garde-fous » n'est pas touchée.
- Vérification : aucun test ne fige ces phrases (recherche dans `.claude/hooks/tests` et
  `scripts/ci`) ; `pnpm hooks:test` 842 sur 842 après les éditions.

## Commandes ordinaires (point 4)

- `ordinary-commands.test.mjs` (L14-07) reste vert, avec les 88 commandes de l'orchestrateur et
  l'échantillon d'agent.
- `git worktree add -b lot/x <dossier> develop` reste permis à la session principale, testé dans
  `main-glued-options.test.mjs`, avec ou sans `main` locale.
- `branch-tracking.test.mjs`, `main-branch.test.mjs`, `main-commit.test.mjs`, `config-read.test.mjs`
  et `git-push.test.mjs` restent verts.

## Preuves

| Critère | Commande | Résultat |
| --- | --- | --- |
| Tests des garde-fous, avant | `pnpm hooks:test`, nouveaux fichiers, code de `develop` | 842 tests, 34 échecs (16 L19-01, 16 L19-02, 2 défauts du test L19-02 corrigés) |
| Tests des garde-fous, après | `pnpm hooks:test` | 842 sur 842 (798 de `develop` + 44 nouveaux) ; idem après les fichiers d'agent |
| Comportement de git | scripts du dossier de session, git 2.30.2 et 2.43.0 | tableaux ci-dessus |
| Intégrité depuis la base | `pnpm integrity develop` | « Intégrité des tests : OK » |
| Tests du script d'intégrité | `pnpm integrity:test` | 19, 3, 13, 8, 95, 13, 13, 12, 8, 9 réussis, 0 échec |
| Hook pre-commit | chaque commit | lint, typecheck, test : 10 tâches sur 10 réussies |
| Mesure L19-03 | `pnpm --filter @siteperso/api test:e2e`, avec et sans `TEST_MAX_WORKERS=4` | à faire (consigne) |
| `pnpm check` | | non lancé : règle D26, la recette le lance |

## Points ouverts

1. **Mesure de L19-03 à faire** (commandes ci-dessus). Tant qu'elle n'est pas faite, l'effet de la
   borne est déduit du code de Vitest et de la configuration, pas observé.
2. **Front** : `apps/web/vitest.config.ts` ne lit pas `TEST_MAX_WORKERS` (fichier hors de mon
   périmètre). Changement proposé à la session front : charger le `.env` racine comme l'API, puis
   `...(process.env.TEST_MAX_WORKERS ? { maxWorkers: <valeur validée> } : {})` à la racine de
   `test`, hors Stryker. `passThroughEnv` de `test` et `test:coverage` la transmet déjà au front.
3. **Limites connues de L19-01.**
   - Un mot entièrement calculé en position d'opérande (`git checkout "$X"`, `git switch -c a
     $START`) est lu comme un nom de branche ou un point de départ, pas comme une option ; il pourrait
     valoir `-bmain`. Le refuser casserait `git switch -c a $START`, permis à la session principale
     par un test du lot 18. À décider par Julien.
   - `checkout.guess` n'est lu que dans `-c`, comme au lot 18 (plus strict).
4. **Limites connues de L19-02, à décider par Julien.**
   - Les clés qui lancent une commande (`core.pager`, `core.editor`, `core.sshCommand`…) et les
     alias `push` sont analysés dans `-c` mais pas dans `GIT_CONFIG_PARAMETERS`,
     `GIT_CONFIG_KEY_<n>` ni `--config-env`. Proposition : leur appliquer la même analyse que `-c`.
   - `declare -n R=HUSKY; R=0` n'est pas lu (seule la cible `GIT_CONFIG_*` d'une référence de nom
     l'est).
   - `source` d'un fichier qui exporte ces variables suit la règle générale des scripts.
5. **`docs/03-organisation-agents.md`** cite peut-être `pnpm check` par agent : je n'y touche pas
   (décisions validées, hors de mon droit d'écriture sur le fond) ; à reporter par l'orchestrateur si
   besoin.
6. **Commits intermédiaires.** `ae9815c` a été indexé par un correctif partiel de `lib/shell.mjs`
   (blocs L19-01 seuls, `git apply --cached`). Les tests ont tourné sur l'arbre complet, pas sur ce
   seul commit ; le hook pre-commit (lint, typecheck, unitaires des paquets) y est passé.
7. **Refus rencontrés et respectés.**
   - Une édition d'un script du dossier de session faite et lancée par la même commande : écrite
     d'abord, lancée ensuite.
   - Un script `sh` du dossier de session qui citait `.husky/_` comme valeur dans un dépôt jetable
     (écriture opaque qui mentionne un oracle) : valeur remplacée par un nom neutre ; aucun fichier
     de `.husky/` n'était visé.
   - Une édition d'un nouveau fichier de test par `python3` : refaite avec l'outil Edit.
   - Un script `node` qui résolvait la configuration Vitest de l'API sans lancer de test (vérifier
     `maxWorkers` de chaque projet) : refusé (écriture opaque qui mentionne `apps/api`). Je ne l'ai
     pas reformulé ; la mesure du point 1 en tient lieu.
