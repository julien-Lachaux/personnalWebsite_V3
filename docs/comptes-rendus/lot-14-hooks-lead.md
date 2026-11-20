# Lot 14, branche des garde-fous : hooks, script d'intégrité, fichiers d'agents (lead-architecte)

Branche `lot/14-hooks` créée depuis `lot/14-garde-fous-ci` à `f98e4dd`, worktree
`.claude/worktrees/lot-14-hooks`, 20 novembre 2026. Tickets L14-01, 02, 06, 07, 11, 12, 13, 14
(`docs/backlog.md`, section 7 sexies). Autorisation nominative « config » `76c90a2a` (ticket
L14-hooks : `.claude/hooks/**`, `scripts/ci/**`, `.claude/agents/**`). Isolation Docker : `.env`
racine fourni (projet `siteperso-v3-lot14h`, ports 5762 à 5765) et `apps/api/.env` sur 5762, non
modifiés. Rien n'a été poussé ; aucun worktree géré. Aucun fichier de l'autre branche du lot touché
(`package.json`, `.husky/`, `turbo.json`, configurations Vitest, Playwright, Stryker, `apps/**`,
`.github/`).

## Fait, par ticket

| Commit    | Ticket | Sujet |
| --------- | ------ | ----- |
| `23b0650` | L14-11 | marqueur interdit enchaîné sur plusieurs méthodes de test (`MARKER_RE`, `FORBIDDEN_RE`) |
| `ed7d504` | L14-12 | un fichier devenu test en cours de session est protégé (`checkFileTool`, shell, fin de tâche) |
| `21a42db` | L14-13 | `git worktree remove`, `move` et `prune` réservés à la session principale |
| `c865562` | L14-06 | la branche locale `main` ne s'écrit pas, par aucune session (sauf `git commit`, point ouvert 1) |
| `40597b5` | L14-07 | 88 commandes ordinaires de l'orchestrateur et refus de push pour les quatorze rôles |
| `943ce1a` | L14-01 | directive `Stryker disable` sans équivalent déclaré refusée dès l'écriture |
| `a3cf6ab` | L14-02 | contrôle à la ligne des directives (commit qui l'ajoute, ligne et mutateur déclarés) |
| `ec8eee8` | L14-07 | rejeux des tests du lot par l'analyse et en parallèle (durée de `pnpm hooks:test`) |
| `8b1f0e0` | L14-14 | section commune « Git et garde-fous » des quatorze fichiers d'agent, et son test |
| `98795e2` | tous   | règles du lot dans `CLAUDE.md`, `docs/03-organisation-agents.md`, `.claude/hooks/README.md` |
| (ce CR)   |        | compte rendu |

Chaque commit qui touche une configuration protégée porte `Justification-test: L14-xx <raison>`.
Aucun test existant modifié ni supprimé : `git diff --name-status f98e4dd..HEAD` ne montre que des
fichiers de test ajoutés (`A`). `ec8eee8` ne retouche que trois fichiers de test créés par ce lot
(absents de `develop`) : mêmes cas, mêmes verdicts attendus, durée seule.

### L14-11 : marqueurs interdits enchaînés

`lib/policy.mjs` (`MARKER_RE`) et `scripts/ci/check-tests-integrity.sh` (`FORBIDDEN_RE`) : un
marqueur de saut ou de focus est reconnu devant une parenthèse, ou devant une méthode quelconque
suivie d'une parenthèse ou d'un gabarit, précédée de zéro, une ou plusieurs méthodes de l'API de test
de Vitest 5 (`each`, `for`, `concurrent`, `sequential`, `shuffle`, `skip`, `only`, `todo`, `fails`,
`skipIf`, `runIf`, `extend`, `scoped`, `override`). L'ancienne forme (une méthode quelconque) est un
cas particulier (zéro méthode de l'API), donc rien de refusé avant n'est accepté après. Les méthodes
intermédiaires sont limitées à l'API de test pour ne pas créer de faux positif (`cfg.todo.items.map(`
reste accepté, comme avant). `FAILS_RE` reconnaissait déjà les enchaînements multiples (BF-9) :
inchangé.

Tests : `.claude/hooks/tests/marker-chain.test.mjs` (hooks) et `scripts/ci/tests/marker-chain.test.sh`
(script), chacun avec une copie figée des expressions d'avant (voir « Comparaison »).

### L14-12 : fichier devenu test en cours de session

`lib/state.mjs` : nouvelle fonction `existedAtSnapshot(snapshot, rel)` (oracle relevé, fichier du
commit `head` de l'instantané par `git cat-file -e`, ou fichier non suivi relevé). `guard.mjs` :
`checkFileTool` et `checkShellTarget` traitent un fichier de classe « test » comme existant s'il
existait à l'instantané, même hors de ses oracles : le modifier exige l'autorisation « tests ». Par
cohérence, `verifySnapshot` signale aussi en fin de tâche la modification (« oracle modifié ») ou la
suppression (« oracle supprimé ») d'un tel fichier sans autorisation ni commit justifié ; un test
créé pendant la tâche reste libre. Test : `.claude/hooks/tests/test-widening.test.mjs` (élargissement
obtenu par les hooks avec un fichier du `head` hors index et ignoré à l'instantané, et par la
bibliothèque comme pour BF-10). L'état des hooks y vit dans un dossier de projet temporaire distinct
du dépôt, sans chemin de l'état écrit dans le test (un premier Write qui le nommait a été refusé par
la règle « code qui vise l'état des garde-fous » : refus respecté, test réécrit sans ce chemin).

### L14-13 : gestion des worktrees

`lib/shell.mjs`, `analyzeGit` : `git worktree remove` (forcé ou non), `move` et `prune` refusés à
tout rôle autre que `main`, sous toutes les formes lues (alias git, `-C`, blocs, `bash -c`, `xargs`) ;
sous-commande illisible refusée. `list` et `add` restent permis aux agents. Test :
`.claude/hooks/tests/worktree.test.mjs` (quatorze rôles lus dans les frontmatters, session principale).

### L14-06 : branche locale main

`lib/shell.mjs` : la branche courante est lue (`git symbolic-ref -q HEAD`) ou suivie dans la
commande (`checkout`, `switch`, `worktree add`, `symbolic-ref HEAD`, `rebase <amont> <branche>`,
sous-shells et code imbriqué compris, état partagé et jamais restauré en sortie de sous-shell).
Refusés à toutes les sessions :

- branche courante `main` : `merge`, `pull`, `rebase`, `cherry-pick`, `revert`, `am` (hors
  `--abort`, `--quit`), `reset <commit>` qui déplace la branche (pas `reset`, `reset --hard` vers
  `HEAD`, `reset -- <chemins>`), `branch -m <nouveau>` ;
- toujours : `branch` qui crée, force, renomme, copie vers ou supprime `main` ; `checkout -b|-B|
  --orphan|--track` et `switch -c|-C|--orphan|--track` vers `main` ; `worktree add -b|-B main` ;
  `update-ref` (et `--stdin`) sur `refs/heads/main`, `heads/main`, `main`, ou `HEAD` quand elle est
  `main` ; `symbolic-ref refs/heads/main` ; `fetch` ou `pull` vers `main` (`…:main`) ;
  `rebase <amont> main`.

Illisible donc refusé : écriture de la branche courante quand elle est illisible (dossier ou dépôt
calculé, `--git-dir`, `GIT_DIR`, `checkout -`, dossier qui n'existe pas encore), nom de branche ou
refspec écrits calculés, références lues sur l'entrée standard (`xargs git branch`, `… | git
update-ref --stdin`). Restent permis, par la décision : `git tag` (et `tag -f`), `branch -f develop
main`, `update-ref refs/heads/develop main`, `checkout -B develop main`. Test :
`.claude/hooks/tests/main-branch.test.mjs`.

### L14-07 : commandes ordinaires et refus de push pour tous les rôles

`.claude/hooks/tests/ordinary-commands.test.mjs` :

- les 88 commandes de la recette du lot 13 bis (script `ord.mjs` du chef de projet, retrouvé dans sa
  transcription), chemins rendus neutres (dépôt et dossiers temporaires du test, aucune donnée
  personnelle) : les 88 restent permises à la session principale, nouvelles règles comprises ;
- un échantillon de 34 de ces commandes qu'un agent lance aussi (lectures, `git commit`, `git add`,
  `pnpm`, `docker`, `.env`, dossier de session) : permis à `dev-api`, `qa`, `chef-de-projet` et
  `revue-code`, un rôle par famille de chemins d'écriture de `ROLE_WRITE_SCOPES` ;
- les 124 commandes distinctes de la recette du lot 13 (`recette-13.test.mjs`, rejouées là pour
  `dev-api` seul) : les 119 refusées à un agent le sont pour chacun des quatorze rôles (analyse de la
  commande, sinon hook complet pour ce qui relève des cibles, comme `git reset --hard main`), les 5
  autres (`branch -f develop main`, `update-ref refs/heads/develop main`, `checkout -B develop main`,
  `tag v1`, `merge develop`) restent permises ; les quatre formes de push de la session principale
  sont refusées par le hook complet à chacun des quatorze rôles, avec le motif « interdit aux agents
  (rôle …) ».

### L14-01 : directive Stryker disable dès l'écriture

`lib/policy.mjs` : `declaredEquivalentIds`, `countUndeclaredDirectives` (même motif de directive et
même forme d'identifiant que le script d'intégrité). `guard.mjs` : `checkFileTool` refuse, dans un
fichier JS/TS d'un dépôt, toute écriture qui augmente le nombre de directives sans identifiant ou
citant un identifiant absent des `stryker.equivalents.json` (suivis ou non) du dépôt ; une directive
déjà présente ne bloque pas les autres modifications. Le shell : refus quand la commande écrit un
fichier de code ou fait une écriture opaque et que son texte porte une telle directive (lecture
large, une barre oblique échappée ne la cache pas). Vaut pour toutes les sessions, comme les
marqueurs. La prose hors code (`.md`, `.txt`) et la lecture (`grep`, `git log --grep`) restent
libres. Test : `.claude/hooks/tests/stryker-directive-write.test.mjs`.

### L14-02 : contrôle à la ligne des directives

`scripts/ci/check-tests-integrity.sh` : les lignes ajoutées portent désormais leur numéro (en-tête
`+c,d` de chaque section, `NR` pour un fichier non suivi). Point 5 inchangé (justification du
fichier), plus un point 5 bis pour chaque directive ajoutée dans un fichier suivi :

- `git blame` attribue la ligne : non commitée, refusée (« non commitée ») ; ajoutée par un commit
  de la branche sans ligne `Justification-test`, refusée, même si un autre commit justifié touche le
  fichier (le trou constaté en recette du lot 12) ; attribuée à un commit de la base, laissée ;
- `scripts/ci/stryker-directives.mjs` (nouveau, lancé par `node`) : chaque équivalent déclaré que
  la directive cite doit désigner son fichier (champ `file`, relatif au dossier du
  `stryker.equivalents.json`), la ligne qu'elle retire du score (la suivante pour `next-line`, sinon
  la plage jusqu'au `Stryker restore` suivant ou la fin) et l'un de ses mutateurs (`all` les couvre).
  Fichier d'équivalents illisible : refusé plutôt que lu de travers ; `node` absent : refusé.

Le point 6 (identifiants déclarés dans tout l'arbre) est inchangé. Les deux directives réelles de
`develop` (`env.schema.ts:76` avec API-EQ-01 ligne 77 StringLiteral, `sql-statements.ts:62` avec
API-EQ-04 et API-EQ-05 ligne 63 MethodExpression et BlockStatement) satisfont la nouvelle règle :
dans un clone jetable, les deux lignes retouchées (ponctuation de la raison) et commitées avec
justification donnent `pnpm integrity origin/develop` OK ; le mutateur de la première changé en
BooleanLiteral donne l'écart « env.schema.ts:76 : API-EQ-01 ne désigne pas ce que la directive
retire (la ligne 77, mutateur BooleanLiteral) ; déclaré : …env.schema.ts:77 StringLiteral ».
Test : `scripts/ci/tests/stryker-directive-line.test.sh` (12 cas).

### L14-14 : section commune des fichiers d'agent

Les quatorze `.claude/agents/*.md` reçoivent, en bloc final ajouté par `cat >>` sans toucher au reste
du fichier (fusion triviale avec le lot F3a pour `dev-front.md` et `revue-a11y.md`), la même section
« Git et garde-fous » : ce que l'agent fait, ce qui lui est refusé (pousser, fusionner dans `main` ou
l'écrire, publier une étiquette, `git stash` nu, contourner le hook pre-commit, retirer, déplacer ou
élaguer un worktree, lancer les scripts des garde-fous, créer une autorisation ou modifier `.claude/`
et `scripts/ci/` sans autorisation) et la conduite face à un refus (ne pas reformuler, sortie
honorable). Rien sur le fonctionnement des détections.
`.claude/hooks/tests/agents-git-section.test.mjs` vérifie : quatorze fichiers et rôles ; section
présente une fois, finale et identique ; trois volets présents ; absence de termes qui décriraient
les détections (analyse, instantané, empreinte, motif, expression régulière, noms des scripts…) ;
chaque puce de la liste des refus a ses commandes de contrôle et réciproquement (une puce ajoutée
sans contrôle fait échouer le test) ; chaque contrôle est refusé à chacun des quatorze rôles.

## Écarts au ticket

1. **L14-06, `git commit` sur `main` non refusé** (sortie honorable, point ouvert 1). Tout le reste
   du ticket est appliqué.
2. **L14-02, partiel** (sortie honorable, point ouvert 2) : la justification n'a pas à citer
   l'identifiant de la directive, et un équivalent sans champ `mutator` n'est contrôlé que sur son
   fichier et sa ligne. Le trou du ticket est fermé autrement : le commit qui ajoute la directive
   doit porter lui-même la justification (attribution par `git blame`), et l'identifiant doit
   désigner exactement la ligne et le mutateur.
3. **L14-14, formulation des refus** : « étiquette » est déclarée sous la forme « publier une
   étiquette de version » et « fusion » sous la forme « fusionner dans `main` » : la création locale
   d'une étiquette reste permise par la décision du 19 nov. (L14-06) et la fusion dans `develop`
   n'est pas un refus des hooks (l'orchestrateur fusionne, la section le dit dans « Ce que tu
   fais »). Ainsi ce que la section déclare refusé l'est par les hooks, ce que le test vérifie, à
   une exception près : « écrire `main` sous quelque forme que ce soit » couvre `git commit` sur
   `main`, que les hooks ne refusent pas encore (point ouvert 1) ; les contrôles du test portent sur
   les formes refusées (fusion, rebase, réinitialisation, `branch -f`, `update-ref`, `checkout -B`).
4. **L14-07, échantillon** : les 88 commandes complètes pour la session principale ; pour les agents,
   34 commandes sur quatre rôles (une par famille de chemins d'écriture) plutôt que les quatorze,
   pour la durée ; les refus de push couvrent bien les quatorze rôles.
5. **L14-12, au-delà de `checkFileTool`** : la même règle s'applique aux écritures shell et à la
   vérification de fin de tâche (même définition d'« existant »), sans quoi le fichier restait
   modifiable par `echo >>` ou supprimable sans signalement.

## Comparaison de l'ancien et du nouveau

Base : code de `f98e4dd` ; les fichiers de test du lot copiés dans un clone jetable du dossier de
session, lancés par `pnpm hooks:test` et `pnpm integrity:test` (les scripts des garde-fous ne se
lancent pas directement depuis un agent : refus respecté). Les tests du lot qui comparent eux-mêmes
l'ancien et le nouveau (L14-11) le font avec une copie figée des expressions d'avant.

| Fichier de test du lot | Sur le code de `f98e4dd` | Sur le code du lot |
| --- | --- | --- |
| `marker-chain.test.mjs` | 2 échecs sur 5 (formes enchaînées non vues ; Write d'un saut enchaîné accepté) | 5 sur 5 |
| `test-widening.test.mjs` | ne se charge pas (`existedAtSnapshot` absent) ; sans le cas propre à cette fonction, 5 échecs sur 7 (Edit et Write, shell, fin de tâche : modification, suppression, commit sans justification) ; passent avant comme après : l'autorisation « tests » et le test créé pendant la tâche | 8 sur 8 |
| `worktree.test.mjs` | 15 échecs sur 18 (quatorze rôles, sous-commande illisible) | 18 sur 18 |
| `main-branch.test.mjs` | 49 échecs sur 52 (seuls les cas « permis » passent) | 52 sur 52 |
| `ordinary-commands.test.mjs` | 36 sur 36 (non-régression : déjà vrai avant) | 36 sur 36 |
| `stryker-directive-write.test.mjs` | 4 échecs sur 7 (aucun refus dès l'écriture) | 7 sur 7 |
| `agents-git-section.test.mjs` | 17 échecs sur 19 (section absente, refus de `main` et des worktrees permis) | 19 sur 19 |
| `marker-chain.test.sh` | 9 échecs sur 95 (les 9 formes enchaînées acceptées) | 95 sur 95 |
| `stryker-directive-line.test.sh` | 8 échecs sur 12 (les 8 refus acceptés : directive glissée, non commitée, autre ligne, autre mutateur, autre fichier, plage trop courte, équivalent hors ligne, fichier illisible) | 12 sur 12 |

L14-11, corpus des deux comparaisons (« aucune forme refusée aujourd'hui ne devient acceptée ») :

- hooks : 10 formes enchaînées (refusées après, aucune vue avant), 28 formes déjà connues (sauts,
  focus, `todo`, `skipIf`, `runIf`, `fixme`, `slow`, `fail`, ignores v8, c8, istanbul, `node:coverage`,
  échecs attendus directs ou enchaînés), 9 formes ordinaires : chaque forme interdite avant l'est
  après, chaque échec attendu avant reste interdit ou soumis à autorisation, le nombre de marqueurs
  interdits ne baisse sur aucune forme, les 9 formes ordinaires restent acceptées ;
- script : 9 formes enchaînées, 30 connues, 8 ordinaires, chacune dans son fichier de test : 39
  refusées par le nouveau, les 30 refusées par l'ancien le restent, les 8 ordinaires restent
  acceptées.

L14-07 vaut démonstration que les nouvelles règles ne cassent pas le travail courant : les 88
commandes de l'orchestrateur et l'échantillon d'agent passent avant comme après, ainsi que les 28
« commandes ordinaires » de `shell-compound.test.mjs` et celles de `guard.test.mjs`.

Nouveaux refus à connaître (voulus, « illisible donc refusé ») : une écriture de la branche courante
après un `cd` calculé (`cd "$W" && git merge …`), un nom de branche ou une refspec calculés
(`git checkout -b "$NOM"`, `git fetch origin $SPEC`), `xargs git branch|update-ref|fetch|pull|rebase`.
Écrire ces commandes en clair.

## Preuves

| Critère | Commande | Résultat |
| --- | --- | --- |
| Tests des hooks | `pnpm hooks:test` | 715 tests, 715 verts (569 avant le lot), 32 s |
| Tests du script d'intégrité | `pnpm integrity:test` | 19, 3, 13, 8, 95, 13, 12, 8 réussis, 0 échec (deux fichiers ajoutés) |
| Intégrité depuis develop | `pnpm integrity develop` | « HEAD comparé à develop (point de divergence 71ff6b5ca636) », OK |
| Avant/après | clone de `f98e4dd` + tests du lot, `pnpm hooks:test`, `pnpm integrity:test` | tableau ci-dessus |
| Commit intermédiaire `21a42db` (index composé : L14-13 seul) | clone à `21a42db`, `pnpm hooks:test` | 600 tests, 600 verts |
| Aucun test existant modifié | `git diff --name-status f98e4dd..HEAD` | fichiers de test : tous `A` |
| Formatage | `pnpm format:check` | aucun écart |
| `pnpm check`, deux passes sur base neuve | voir ci-dessous | voir ci-dessous |

### pnpm check

Deux passes `TURBO_FORCE=true pnpm check` (aucun cache rejoué), code de sortie 0 chacune, chacune
précédée de `docker compose down -v` (projet `siteperso-v3-lot14h` : conteneurs, volume et réseau
supprimés puis recréés). Journaux : `check-lot14h-1.log`, `check-lot14h-2.log` (dossier de session).

| Étape | Passe 1 | Passe 2 |
| --- | --- | --- |
| `pnpm hooks:test` | 715 sur 715 | 715 sur 715 |
| `pnpm integrity:test` | 19, 3, 13, 8, 95, 13, 12, 8 réussis | idem |
| `pnpm integrity` | OK | OK |
| lint, typecheck, unitaires, e2e (`turbo run`) | 12 tâches sur 12 (4 min 50 s) | 12 sur 12 (4 min 40 s) |
| unitaires contrats, API, front | 220, 430, 682 | 220, 430, 682 |
| e2e API, parcours Playwright du front | 758, 252 | 758, 252 |
| couverture fusionnée contrats, front, API | 220, 682, 1188 tests ; 100 % partout | idem |

Le lot ne touche ni au code applicatif ni aux tests Vitest et Playwright : ces nombres sont ceux de
la base.

## Points ouverts

1. **L14-06 : `git commit` sur `main` (sortie honorable).** Le ticket demande de refuser le commit
   quand HEAD est `main` ; un test existant exige le contraire. Démonstration :
   `.claude/hooks/tests/guard.test.mjs`, test « accepte les commandes ordinaires » (lignes 316 à
   328) : son dépôt temporaire est créé par `git init -q -b main` (`makeRepo`, ligne 55) et il
   attend le code 0 pour `git commit -q -m "feat: x"` lancé par `dev-api`. Mesure : dans un clone
   jetable du lot, une ligne ajoutée au cas `commit` de `analyzeGit`
   (`if (!rest.includes('--dry-run')) onMain('git commit');`), puis `pnpm hooks:test` : 715 tests,
   714 verts, 1 échec, exactement celui-ci (`guard.test.mjs:316`, « git commit -q -m "feat: x" :
   Garde-fous : refusé. git commit sur la branche main … », `2 !== 0`). Je n'ai pas modifié ce test
   ni inventé d'exception (dépôt sans remote, par exemple) : le commit sur `main` reste permis, le
   reste du ticket est appliqué. À trancher : soit le correcteur, sur un finding,
   fait créer à ce test un dépôt sur `develop` (le test date d'avant la décision et ne vise pas
   `main`), puis le refus s'ajoute en une ligne (`case 'commit'` : `onMain('git commit')`, sauf
   `--dry-run`) avec ses tests ; soit Julien décide d'une exception.
2. **L14-02 : citer l'identifiant dans la justification, et le champ `mutator` (sortie
   honorable).** Deux tests existants acceptent une directive dont le commit porte
   `Justification-test: MUT-9 mutant équivalent vérifié`, qui ne cite pas `API-EQ-01`, et dont
   l'équivalent déclaré n'a pas de champ `mutator` :
   `scripts/ci/tests/stryker-disable.test.sh`, cas « directive justifiée qui cite un équivalent
   déclaré » (attendu 0) et `.claude/hooks/tests/stryker-disable.test.mjs`, « accepte une directive
   justifiée qui cite un mutant équivalent déclaré » (attendu 0). Mesure, dans le clone jetable :
   le script exige que les lignes `Justification-test` du commit de la directive citent chacun de
   ses identifiants, et `stryker-directives.mjs` exige un mutateur déclaré ; `pnpm hooks:test` :
   715 tests, 1 échec, `stryker-disable.test.mjs:93` ; `stryker-disable.test.sh` : 7 réussis,
   1 échec, « directive justifiée qui cite un équivalent déclaré (code 1, attendu 0) » (les quatre
   cas « accepté » de mon propre `stryker-directive-line.test.sh`, écrits avec la même
   justification, échouent aussi : ils seraient à adapter avec la règle). Appliqué à la place : le commit
   qui ajoute la directive porte lui-même la justification, et l'équivalent désigne la ligne (et le
   mutateur quand il est déclaré, ce qui est le cas des neuf équivalents réels). À trancher : faire
   corriger ces deux tests (identifiant cité, mutateur déclaré), puis ajouter les deux exigences.
3. **Hors périmètre, constaté** : `git branch -u <amont> [branche]` (ou `--set-upstream-to`) écrit
   `branch.<x>.remote` et `branch.<x>.merge` sans passer par la règle de `git config` du lot 13 bis
   (T3, « redéfinition de la destination »). Je ne l'ai pas refusé (aucun ticket). À trancher.
4. **Limite connue (BF-11)** : un agent qui supprime le dossier de son worktree (`rm -rf` d'un chemin
   hors oracles) fait encore disparaître l'instantané sans violation ; L14-13 ne couvre que les
   commandes `git worktree`. Les commits restent contrôlés par `pnpm integrity` en CI.
5. **Effet sur les sessions** : ces règles ne s'appliquent qu'une fois le lot fusionné dans
   `develop` et le checkout principal à jour (les hooks actifs sont ceux de `CLAUDE_PROJECT_DIR`).
   Pendant le lot, mes commandes passaient par l'ancien analyseur. Refus rencontrés et respectés :
   script écrit et exécuté par la même commande (deux fois, réécrit en deux commandes), `node --check`
   d'un fichier des garde-fous, un code `python3` qui citait le dossier des agents, une boucle sur
   des scripts de test (`bash scripts/ci/tests/$t.test.sh`), un Write de test qui nommait le dossier
   d'état des garde-fous (test réécrit sans), `node scripts/ci/stryker-directives.mjs` lancé à la
   main sur les directives réelles (écriture opaque qui cite un oracle : remplacé par
   `pnpm integrity` dans le clone), `git config --get core.hooksPath` (lecture refusée), et une
   erreur de ma part : `git commit --no-verify` dans le clone jetable du dossier de session, refusé ;
   le commit a été refait sans l'option (le clone n'a pas de hook installé).
6. **`.claude/settings.json`** hors de mon autorisation : `permissions.deny` n'a pas reçu de
   doublons pour `git worktree remove|move|prune` ni pour `main` ; l'autorité reste les hooks.
7. **Durée** : `pnpm hooks:test` passe de 27 s à 32 s environ (146 tests de plus), après `ec8eee8`.
