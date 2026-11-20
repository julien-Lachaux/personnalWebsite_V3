# Lot 16 : briefs back-003 (BF-10, BF-11) et back-002 (BF-8, BF-9), lead-architecte

Date : 20 novembre 2026. Branche `lot/16-briefs-002-003` (worktree
`.claude/worktrees/lot-16-briefs-002-003`), créée depuis `develop` à a6d66bf. Isolation : `.env`
racine `siteperso-v3-lot16`, ports 5762 à 5765 ; `apps/api/.env` sur 5762. Autorisation de
configuration 9b3bea41 (ticket BF-8-11). Fichiers modifiés : `.claude/hooks/lib/state.mjs`,
`.claude/hooks/lib/policy.mjs`, `.claude/hooks/guard.mjs`, `.claude/hooks/README.md`,
`scripts/ci/check-tests-integrity.sh` ; fichiers de test ajoutés dans `.claude/hooks/tests/` et
`scripts/ci/tests/`. Aucun test existant modifié, aucun autre fichier protégé touché, `turbo.json`
non touché. Rien dans `apps/`, `db/`, `packages/`.

Les hooks qui protègent les sessions tournent depuis le checkout principal : ces corrections n'y
prennent effet qu'après la fusion dans `develop`. Tout a été prouvé par les tests du worktree
(`pnpm hooks:test`, `pnpm integrity:test`), lancés une fois sans la correction (échec attendu) et
une fois avec.

## Fait

| Ticket | Commit | Livré |
|---|---|---|
| BF-10 | 3a4fe0d | `verifySnapshot` : une configuration ou un garde-fou absent des oracles de l'instantané n'est plus « créé » si son contenu est celui du commit `head` de l'instantané (empreinte de `git show head:chemin`), ou celui du fichier non suivi relevé dans l'instantané. Modifié ensuite, il est signalé « oracle modifié » (et non plus « créé ») sauf autorisation ou commit justifié ; réellement créé, il reste « configuration de test ou garde-fou créé ». |
| BF-11 | 2a40bef | `snapshotRootStatus` (`ok`, `absent`, `retired`, `broken`) dans `state.mjs` ; `verify` de `guard.mjs` supprime à lui seul (`dropSnapshot`) l'instantané d'une racine absente ou retirée, sans attendre que les autres instantanés de la clé soient propres ; `verifySnapshot` ignore ces racines. Retirée = le dossier existe mais n'est plus ce dépôt (plus de `.git`, ou `git rev-parse --show-toplevel` différent) et `git worktree list` du projet ne le liste plus. |
| BF-8 | 6a046cf | `check-tests-integrity.sh` : `git` encapsulé avec `-c core.quotePath=false` ; listes de chemins lues en `-z` (`--name-status -z`, `--name-only -z`) ; lignes ajoutées lues par un diff par fichier dont le chemin vient de la liste (plus de l'en-tête du diff) ; recherche de justification en `--literal-pathspecs`. Hooks vérifiés : leurs chemins viennent déjà de `ls-files -z` et `diff --name-only -z`, rien à corriger, tests ajoutés pour le verrouiller. |
| BF-9 | 129b38c | `MARKER_RE` (`policy.mjs`) et `FAILS_RE` (script) : l'échec attendu de Vitest n'est reconnu que sur un appel direct, ou enchaîné par une ou plusieurs méthodes de l'API de test de Vitest 5 (`each`, `for`, `concurrent`, `sequential`, `shuffle`, `skip`, `only`, `todo`, `fails`, `skipIf`, `runIf`, `extend`, `scoped`, `override`). Marqueurs interdits et `fail` de Playwright inchangés. |

README des hooks : section « Vérification de fin de tâche (instantanés) » (BF-10, BF-11) et phrase
sur le marqueur d'échec attendu (BF-9).

## Tests ajoutés et démonstration avant / après

Chaque fichier a été écrit avant la correction et lancé sur le code de `develop`, puis sur le code
corrigé. Les suites existantes restent vertes avant comme après (549 tests des hooks au départ,
19 + 3 + 8 + 8 cas des scripts).

### BF-10 : `.claude/hooks/tests/snapshot-policy-widening.test.mjs` (5 cas)

L'élargissement de la politique est simulé en retirant le fichier des oracles de l'instantané
(l'instantané qu'aurait pris l'ancienne politique) : directement sur l'objet pour
`verifySnapshot`, et dans le fichier JSON de l'instantané pour le scénario par les hooks
(`subagent-start` puis `verify`).

- fichier existant inchangé → aucune violation ; modifié ensuite sans justification →
  `oracle modifié` ;
- modifié et commité sans justification → violation ; recommité avec Justification-test → aucune ;
- fichier non suivi relevé à l'instantané, inchangé → aucune ; modifié → violation ;
- configuration réellement créée → toujours `configuration de test ou garde-fou créé` ;
- scénario du brief par les hooks : `verify` code 0 tant que `apps/web/playwright.config.ts` est
  inchangé, code 2 et `apps/web/playwright.config.ts : oracle modifié` une fois modifié.

Avant (`pnpm hooks:test`, code de `develop`) : `ℹ pass 550`, `ℹ fail 4` (les quatre cas qui
attendent l'absence de faux positif ; le cas « commité sans justification » passait déjà).
Après : `ℹ pass 554`, `ℹ fail 0`.

### BF-11 : `.claude/hooks/tests/snapshot-retired-root.test.mjs` (5 cas)

Dépôt principal avec oracles du front, worktrees sous `.claude/worktrees/` (gitignoré, comme dans
le dépôt réel), quatre fichiers régénérés dans `apps/web/.nuxt/`.

- worktree retiré (`git worktree remove`), `.nuxt` recréé → `verify` code 0, aucune ligne de
  violation, instantané supprimé ;
- même chose pour un worktree hors de tout dépôt → code 0 ;
- worktree présent dont on supprime un oracle → code 2,
  `apps/web/test/smoke.e2e.ts : oracle supprimé` ;
- deux instantanés pour la même clé (worktree retiré + checkout principal avec un oracle supprimé)
  → seule la violation du principal, l'instantané retiré est supprimé, l'autre conservé ;
- worktree encore enregistré dont le `.git` a été retiré à la main → code 2 et une seule ligne
  (`.git : la racine de l'instantané n'est plus un dépôt git…`), instantané conservé.

Avant : `ℹ fail 4` ; le premier cas reproduit le défaut du brief :
`apps/web/app/pages/index.spec.ts : oracle supprimé`, `apps/web/playwright.config.ts : oracle
supprimé`, `apps/web/test/smoke.e2e.ts : oracle supprimé`, `apps/web/vitest.config.ts : oracle
supprimé`, `2 !== 0` ; le cas « `.git` retiré » donnait code 0 (`0 !== 2`, voir Décisions). Le
cas « worktree présent » passait déjà. Après : `ℹ pass 559`, `ℹ fail 0`.

### BF-8 : `scripts/ci/tests/paths.test.sh` (13 cas) et `.claude/hooks/tests/non-ascii-paths.test.mjs` (4 cas)

Script, avant (code de `develop`, `pnpm integrity:test`) : `5 réussi(s), 8 échec(s)`, dont

- `ÉCHEC test au nom accentué modifié avec justification (code 1, attendu 0)` : le script
  répondait `test existant modifié sans Justification-test : "apps/web/test/cass\303\251.e2e.ts"` ;
- `ÉCHEC échec attendu justifié dans un fichier au nom accentué (avec espace) (code 1, attendu 0)` :
  fichier lu `"b/apps/api/test/\303\251chec attendu.e2e-spec.ts"` ;
- `ÉCHEC configuration protégée au nom accentué créée sans justification (code 0, attendu 1)` :
  `scripts/ci/vérifie.sh` cité avec des guillemets échappait à `^scripts/ci/`, donc **acceptée** ;
- deux `ÉCHEC … cité en clair` (rapports illisibles) ;
- `ÉCHEC justification d'un autre fichier non prise pour celle d'un nom à caractère de glob (code
  0, attendu 1)` : `git log -- 'apps/web/test/[ab].e2e.ts'` retrouvait le commit justifié de
  `a.e2e.ts` ;
- `ÉCHEC ligne « ++ » ajoutée sans effet sur l'attribution du fichier (code 0, attendu 1)` : une
  ligne ajoutée `++ apps/web/test/justifie.e2e.ts` passait pour un en-tête `+++`, et l'échec
  attendu qui la suivait était attribué au fichier justifié ;
- `ÉCHEC chemin avec tabulation refusé (code 0, attendu 1)`.

Après : `13 réussi(s), 0 échec(s)`. Le cas « test accentué modifié sans justification » passait
déjà (le dossier `test/` du chemin cité suffisait au motif), il verrouille le comportement.

Hooks : les 4 cas (édition et `rm` d'un test accentué refusés ; fin de tâche acceptée avec
Justification-test, refusée sans, chemin cité en clair ; échec attendu dans un fichier accentué
avec espace signalé) passent avant comme après : le défaut n'existait pas côté hooks.

### BF-9 : `.claude/hooks/tests/fails-marker.test.mjs` (6 cas) et `scripts/ci/tests/fails-marker.test.sh` (13 cas)

Faux positifs couverts : `GRANTABLE` suivi de la portée d'échec attendu puis `.includes(role)`,
`.map(…)`, `.filter(Boolean)`, `.toString()`, `.length`, `+= 1` ; dans le script, en ligne commitée
et en fichier non suivi. Détections conservées : appel direct, `it.concurrent` puis la portée,
API étendue (`myTest`), enchaînements `each` (appel et gabarit), `for`, `concurrent`, `sequential`,
`extend`, `scoped`, `override`, marqueurs interdits enchaînés après (`skipIf`, `only`), `fail` de
Playwright, écriture refusée par les hooks pour un enchaînement `each`, acceptée avec
justification dans le script.

Avant : hooks `ℹ fail 3` (faux positifs, et enchaînement de plusieurs méthodes non détecté) ;
script `10 réussi(s), 3 échec(s)` (`appel includes … (code 1, attendu 0)`, `appels map et filter
… (code 1, attendu 0)`, `enchaîné par plusieurs méthodes (code 0, attendu 1)`). Après : hooks
`ℹ pass 569`, `ℹ fail 0` ; script `13 réussi(s), 0 échec(s)`.

## Décisions

- **BF-10, fichier non suivi** : en plus du contenu au commit `head` (le brief), le contenu du
  fichier non suivi relevé dans l'instantané vaut « inchangé ». Même raisonnement (le fichier
  existait tel quel à l'instantané), testé. Alternative écartée : s'en tenir à `head`, qui
  laissait le même faux positif pour une configuration non suivie.
- **BF-10, libellé** : un fichier qui existait à l'instantané et qui a changé est signalé
  `oracle modifié` plutôt que `créé`. Le libellé « créé » reste pour un fichier réellement nouveau
  (test existant `détecte un marqueur ajouté hors hooks et une configuration créée` inchangé).
- **BF-11, worktree encore enregistré** : le brief traite « plus de `.git` » comme un retrait. Pris
  tel quel, supprimer le `.git` d'un worktree vivant ferait disparaître toute vérification de fin
  de tâche de ce worktree : aujourd'hui ses oracles restent comparés sur le disque (empreintes),
  donc un oracle modifié est vu, `.git` présent ou non. J'ai donc ajouté une condition : la racine
  n'est retirée que si `git worktree list` du projet ne la liste plus (le cas du brief :
  `git worktree remove`). Sinon, une violation unique (`.git : la racine de l'instantané n'est
  plus un dépôt git…`), au lieu d'une par oracle. Alternative écartée : appliquer le brief à la
  lettre (détection affaiblie). Effet de bord connu : retirer le `.git` d'un worktree vivant sans
  rien modifier passait (code 0) et donne maintenant cette violation unique ; un worktree supprimé
  par `rm -rf` sans `git worktree prune`, puis recréé par un outil, la donne aussi (au lieu d'une
  violation par oracle), avec la marche à suivre dans le message. Avant la correction, le cas de
  test « `.git` retiré » donnait code 0 (`0 !== 2`).
- **BF-11, `git worktree list --porcelain` sans `-z`** : `-z` n'existe qu'à partir de git 2.36,
  l'hôte a git 2.30.2 (même précaution que `mainCheckoutOf`).
- **BF-8, au-delà des accents** : le diff par fichier et la recherche littérale corrigent deux
  défauts de même nature, trouvés en écrivant les tests (nom à caractère de glob, ligne ajoutée
  commençant par « ++ »), qui permettaient de faire passer un changement non justifié. Un chemin
  avec tabulation ou saut de ligne est refusé (illisible donc refusé, comme dans les hooks) plutôt
  que lu de travers. Les lignes ajoutées sont calculées une fois au lieu de deux : sur un diff de
  419 fichiers (`pnpm integrity HEAD~40`), 17,8 s au lieu de 28,6 s.
- **BF-9, liste des méthodes** : relevée dans Vitest 5.1.1 (`createChainable` et méthodes de
  `createTaskCollector` dans `vitest/dist/chunks/run.*.js`), plus `sequential` et `shuffle`
  (clés d'autres versions ou des suites) pour ne rien perdre. `describe`, `suite` et les
  crochets (`beforeEach`…) n'en font pas partie : ils ne déclarent pas un test en échec attendu.
  Le préfixe reste libre (une API étendue `myTest` doit être détectée). L'enchaînement de
  plusieurs méthodes (`each` après `concurrent`), qui échappait à l'ancien motif, est désormais
  détecté.

## Vérifications finales

- `pnpm hooks:test` : `ℹ pass 569`, `ℹ fail 0` (549 au départ + 20 ajoutés).
- `pnpm integrity:test` : `19`, `3`, `13` (fails-marker), `8`, `13` (paths), `8` réussis, 0 échec.
- `pnpm integrity develop` : `Intégrité des tests : OK`.
- `TURBO_FORCE=true pnpm check`, `docker compose down -v` avant chaque passe : deux passes vertes
  (`Tasks: 12 successful, 12 total`, puis couverture `Tasks: 4 successful`, 100 % sur contracts,
  api et web). Une passe intermédiaire a échoué hors du lot : charge de l'hôte à 96 sur 16 cœurs
  (autres worktrees en `pnpm check`), workers Vitest d'`apps/web` en délai de démarrage
  (`Timeout waiting for worker to respond`, `HookTimeoutError`) ; relancée une fois la charge
  retombée, verte. Aucun fichier d'`apps/web` n'est touché par ce lot.
- `pnpm db:down` en fin de lot.

## Non fait

Rien du périmètre des quatre tickets.

## Points ouverts

1. **Pendant de BF-10 côté protection** (`guard.mjs`, `checkFileTool`) : un test existant est
   reconnu par `rel in snapshot.oracles`. Si la politique s'élargit en cours de session, un
   fichier devenu test (existant au `head`) est pris pour un nouveau fichier : éditable sans
   autorisation, et `verifySnapshot` ne vérifie pas les tests absents de l'instantané. La CI le
   rattrape s'il est commité. Correction possible : considérer aussi comme existant un fichier
   présent au `head` de l'instantané. Hors brief, non fait.
2. **Marqueurs interdits enchaînés deux fois** : l'enchaînement libre des marqueurs interdits
   (hooks et script, inchangé) n'accepte qu'une méthode avant la parenthèse ; `skip` suivi de
   `concurrent` puis `each` n'est pas reconnu par le motif (lecture de l'expression régulière :
   la lookahead exige `(` ou un gabarit juste après la première méthode). Même correction que
   BF-9 possible (`(?:\.\w+)+`), à décider : elle s'applique aussi au balayage de tout l'arbre
   (section 4 du script). Hors brief, non fait.
3. **Cache Turborepo partagé** : le hook pre-commit de chaque commit a rejoué des journaux
   d'autres worktrees (`lot-F4-donnees`, `lot-F3b-coquille`) ; défaut connu, en cours de
   correction par la session front. `pnpm check` lancé avec `TURBO_FORCE=true`.
4. **Charge de l'hôte** : avec plusieurs worktrees en `pnpm check` simultané, les tests Nuxt
   d'`apps/web` dépassent leurs délais de démarrage (voir Vérifications finales). Aucun délai n'a
   été touché ; à surveiller si les sessions parallèles se multiplient.
