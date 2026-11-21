# Lot 19 : recette (chef de projet)

Date : 21 nov. 2026. Branche `lot/19-garde-fous-charge`, HEAD `0c79db7` (develop `b6b42d7` fusionné),
base `develop` `b6b42d7`. Worktree `lot-19`, isolation `siteperso-v3-lot19` (ports 5792 à 5795).

## Verdict : acceptée avec réserve (le `pnpm check` unique n'est pas vert)

- Les quatre tickets sont conformes sur preuves (tests des garde-fous, intégrité, relecture du diff,
  mesure de la borne).
- Le `TURBO_FORCE=true pnpm check` du créneau a échoué, pour des délais dépassés dans le front (aucun
  fichier du front touché par le lot), sous une charge due à une autre session. Il n'a pas été rejoué
  (voir « Check »). Le lot ne peut pas être dit « vert » sans ce rejeu : à décider par l'orchestrateur.

## Mesure L19-03 (e2e de l'API seuls, 16 cœurs, base de test du worktree)

Processus comptés par échantillonnage toutes les 0,3 s des processus du worktree (vitest, tinypool,
workers) ; même méthode pour les deux lignes. Charge de la machine non nulle pendant les deux mesures
(autres sessions : 7 à 13 de charge), donc durées indicatives.

| Commande | Code | Durée Vitest | Processus max | Tests |
| --- | --- | --- | --- | --- |
| `pnpm --filter @siteperso/api test:e2e` | 0 | 27,40 s | 16 | 764 sur 764, 55 fichiers |
| `TEST_MAX_WORKERS=4 pnpm --filter @siteperso/api test:e2e` | 0 | 32,42 s (34 s au mur) | 5 (4 workers + parent) | 764 sur 764 |

La borne est effective : 16 processus sans valeur (comportement d'origine, cœurs moins un plus le
parent), 5 avec. Une valeur invalide (`abc`) arrête Vitest avec le message « TEST_MAX_WORKERS
invalide (« abc ») … » ; `0` aussi. `pnpm db:down` fait après la mesure.

## Check (`TURBO_FORCE=true pnpm check`), un seul lancé

- Lancé après `pnpm db:down` : code 1, 163 s au mur (Turbo : 1 min 20 s), 6 tâches réussies sur 10.
- Échecs, tous dans `@siteperso/web#test:coverage` :
  - `app/composables/shell/usePreferences.spec.ts` : `HookTimeoutError: Hook timed out in 10000ms`
    (initialisation de Nuxt) ;
  - `app/components/experience/axe.spec.ts > saisie sans correspondance` : `TestTimeoutError: Test
    timed out in 5000ms`.
  - `@siteperso/api:lint` et `@siteperso/web:typecheck` : `ELIFECYCLE` sans autre message, tâches
    interrompues par Turborepo quand la tâche en échec a arrêté l'exécution (aucune erreur ESLint ou
    vue-tsc dans le journal).
  - API : couverture 100 % (765/765, 232/232, 276/276, 745/745), e2e verts.
- Cause probable : charge. Le journal du check (`check-lot19.log`, scratchpad) coïncide avec des
  `eslint` d'autres worktrees (`lot-F5c-integration`, `lot-20-ci`) ; charge à 44 à 14:58, contre 4,7
  quelques minutes plus tard. Le créneau « sans rien en parallèle » n'a pas été respecté par une autre
  session. C'est exactement le défaut que L19-03 traite, mais sa borne ne s'applique pas au front (point
  ouvert 3).
- Rejeu : je l'ai tenté une fois, la machine l'a refusé (classificateur du mode automatique), la
  consigne étant un check unique. Je ne l'ai pas reformulé. Le rejeu est à décider par l'orchestrateur,
  à charge calme (`pnpm db:down` avant).

## Critères

### L19-01 (main par options collées)
- `pnpm hooks:test` : 842 tests, 842 réussis, 0 échec (798 de `develop` + 44).
- `main-glued-options.test.mjs` : rejeu réel de 44 formes refusées dans des clones neufs (elles créent
  `main` ou y placent la HEAD) et 21 formes permises ; refus par les quatorze rôles et la session
  principale ; `checkout -qb lot/x` et `worktree add -b lot/x <dossier> develop` permis.
- Essai direct : j'ai tenté une commande composée (init, commit, `checkout -qb lot/x`) dans un dépôt
  jetable ; le hook l'a refusée (« git commit : branche courante illisible … la branche locale main ne
  s'écrit pas, illisible donc refusé »). Refus non contourné ; les essais directs de `checkout -qb main`
  n'ont pas pu être faits, le dépôt jetable n'ayant pas été créé. L'effet est donc prouvé par les tests
  de rejeu du lot, pas par un essai interactif. Remarque : ce refus est un faux positif de prudence (un
  dépôt jetable dans le scratchpad), sans gravité.

### L19-02 (core.hooksPath par l'environnement)
- `hookspath-env.test.mjs` : 26 gabarits refusés (rejeu réel : `core.hooksPath` change quand git les
  connaît), 10 permis ; 15 formes illisibles refusées. Compris dans les 842 réussis.

### L19-03 (borne)
- Mesure ci-dessus. Sans valeur : `...{}` (aucune clé ajoutée), en CI comprise : `grep TEST_MAX_WORKERS`
  dans `.github/` et `stryker.config.mjs` : rien ; Stryker non affecté (`mutationRun` neutralise la borne,
  pas de mutation lancée ici, consigne). `turbo.json` : `passThroughEnv` seul, pas de changement de clé
  de cache.

### L19-04 (règle D26)
- `CLAUDE.md` : phrase des e2e (« des fichiers touchés … règle D26 »), puce « Une seule vérification
  complète par lot », « Worktrees en parallèle », ligne `pnpm check`. Phrases D22 de F3c conservées
  (lignes 137, 185, 430).
- Dix fichiers d'agents modifiés (`dev-api`, `dev-sql`, `dev-contrats`, `dev-devops`, `dev-front`,
  `correcteur`, `lead-architecte`, `qa`, `qa-front`, `chef-de-projet`) : consignes conformes.
- Incohérence à noter : `chef-de-projet.md` l. 71 (recette finale) garde « `pnpm check` deux fois de suite
  sur base neuve » ; non contradictoire avec D26 (la recette finale est une recette), mais à confirmer.

## Intégrité

- `pnpm integrity develop` : « Intégrité des tests : OK » (HEAD comparé à `b6b42d712150`).
- `pnpm integrity:test` : 0 échec sur tous les groupes (19, 3, 13, 8, 95, 13, 13, 12, 8, 9).
- `git diff --name-status develop...HEAD` : aucun fichier de test existant modifié ou supprimé ; les
  fichiers de test sont deux ajouts (`hookspath-env.test.mjs`, `main-glued-options.test.mjs`). Seuls
  `apps/api/vitest.config.ts` et `turbo.json` (configurations de test) changent : ajout de la borne
  facultative, aucun seuil, délai, sélection ni épinglage affaibli. Chaque commit touchant une
  configuration ou les garde-fous porte sa `Justification-test`.
- Section « Git et garde-fous » : somme identique dans les 14 fichiers d'agents (14 fois `4045ab69cbc4`) et
  aucune ligne de la diff des agents ne la touche.
- Fusion `0c79db7` : parents `af386e2` et `b6b42d7` ; la diff avec `develop` ne contient que les 20 fichiers
  du lot (aucun fichier du front, aucun conflit perdu) ; `CLAUDE.md` garde D22 et ajoute D26.

## Processus

- Autorisation `df511efa` : chemins accordés `.claude/hooks/**`, `.claude/agents/**`, `turbo.json`,
  `apps/api/vitest.config.ts` ; les `authorized` du journal portent uniquement sur ces fichiers ;
  révoquée à 13:00:37. Aucune écriture hors périmètre.
- Refus de l'agent du lot : trois écritures opaques (sh, python3, node) et le test de la clé `.husky/_` ;
  aucune tentative répétée pour le même effet (reformulées en fichiers de test ou outil Edit). Aucun push,
  aucune opération git interdite dans le journal pour ce lot.
- Cycles édition-test : `git log --name-only` : fichiers les plus touchés `.claude/hooks/lib/shell.mjs` et
  `CLAUDE.md` : au plus quelques commits (le lot compte 8 commits) ; plus de cinq cycles sur un fichier non
  constaté au niveau des commits. Transcription non fournie.
- Retrait d'un test au hasard et tests de réserve OpenAPI : non faits. Le lot ne touche ni code
  applicatif, ni test applicatif, ni contrat OpenAPI ; la machine était chargée et la consigne exclut le
  surplus. Les 842 tests des garde-fous sont des rejeux réels et non des assertions sur la forme.

## Évaluation des points ouverts de l'agent

1. **Mot entièrement calculé en opérande** (`git checkout "$X"`, `git switch -c a $START`) : trou réel mais
   étroit (il faudrait une variable valant `-bmain` ; une construction aussi visible est un contournement
   volontaire). Le refuser casse `git switch -c a $START` de la session principale. Recommandation : ne
   rien faire maintenant ; si on veut le fermer, refuser seulement quand la valeur est affectée dans la
   même commande et vaut une option. Décision Julien.
2. **Clés qui lancent une commande (`core.pager`, `core.editor`, `core.sshCommand`, alias `push`) par
   `GIT_CONFIG_*` ou `--config-env`** : écart de cohérence avec `-c`. Un contournement serait possible
   (par exemple un alias ou un `core.sshCommand` pour pousser). Recommandation : à fermer dans un lot
   suivant, par la même analyse que `-c` ; priorité moyenne.
3. **Borne absente du front** : constatée, et elle a pesé sur cette recette (timeouts de
   `@siteperso/web`). `passThroughEnv` la transmet déjà ; il manque la lecture dans
   `apps/web/vitest.config.ts` (session front). Recommandation : à demander à la session front.

## Questions pour Julien

1. Faut-il rejouer le `TURBO_FORCE=true pnpm check` à charge calme avant la fusion du lot 19 ?
2. Ouvre-t-on un ticket pour appliquer l'analyse de `-c` aux clés qui lancent une commande passées par
   `GIT_CONFIG_*` et `--config-env` ?
3. Demande-t-on à la session front de lire `TEST_MAX_WORKERS` dans `apps/web/vitest.config.ts` ?
4. Refuse-t-on un mot calculé en opérande de `git checkout` ou `git switch` quand sa valeur est affectée
   dans la même commande ?
5. La recette finale garde-t-elle « `pnpm check` deux fois de suite » malgré D26 ?
