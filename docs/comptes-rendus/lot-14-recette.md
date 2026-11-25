# Recette du lot 14 (garde-fous, CI, optimisations des tests)

Chef de projet, 20 nov. 2026. Branche `lot/14-garde-fous-ci`, examinée à fe4ddff puis à **d8fcc8c**
(fusion de `develop` b3ca884, lot F3a). Base de comparaison : 71ff6b5. Clone neuf, ports 577x, Docker isolé.

## Verdict : accepté avec réserves

Aucun oracle affaibli, aucun test existant (`*.spec.ts`, `*.e2e-spec.ts`) modifié, `pnpm check` vert,
mêmes tests exécutés, couverture 100 % sur les trois paquets. Les réserves sont mineures (voir plus bas).

## Preuves

### Intégrité (point 2)

- `pnpm integrity 71ff6b5` sur d8fcc8c : « Intégrité des tests : OK » (code 0). Même résultat contre b3ca884.
- `git diff --name-status 71ff6b5...HEAD` : aucun `*.spec.ts` ni `*.e2e-spec.ts` modifié ; un seul ajouté
  (`apps/api/test/db/template-database.e2e-spec.ts`, 6 tests).
- Tests existants de `develop` modifiés, liste complète (rien d'autre) :
  - `apps/api/test/support/{database,global-setup,override-app,test-app}.ts` (L14-15, commit e4aa86d,
    `Justification-test: L14-15`, autorisation fd2ba1f4 limitée à `apps/api/test/support/**`). Les assertions
    des e2e sont intactes ; la remise à zéro recopie un modèle migré et seedé au lieu de tout rejouer ;
    renforcé par le test d'égalité schéma et données (fc412b0).
  - `.claude/hooks/tests/guard.test.mjs` : +3 lignes, le dépôt temporaire du test « accepte les commandes
    ordinaires » passe de `main` à `develop` (aa6c61f, `Justification-test: L14-06`). Assertions inchangées.
  - `.claude/hooks/tests/stryker-disable.test.mjs` et `scripts/ci/tests/stryker-disable.test.sh` : le cas
    « directive justifiée acceptée » déclare maintenant le mutateur et cite l'identifiant (51b2665, 9505aa8,
    `Justification-test: L14-02`). Même verdict attendu (code 0), entrée plus stricte : oracle renforcé.
  - Créés dans le lot puis retouchés : `stryker-directive-line.test.sh` (9066de3), `main-branch.test.mjs`
    (b64b0c3, commentaire d'en-tête seul), les trois tests de ec8eee8 (durée, ajouts seuls),
    `static-analysis.test.sh` (fe4ddff). Chaque commit porte sa ligne `Justification-test`.
- Autres configurations protégées touchées, toutes justifiées : `apps/api/vitest.config.ts` (retrait de
  `fileParallelism: false`, commentaire d'explication ; ni `include`, ni seuils, ni délais changés),
  `turbo.json` (`web#test:e2e` dépend de `test:coverage` au lieu de `test`), `package.json` (`check`),
  `ci.yml`, `.husky/pre-commit`, `apps/api/stryker.config.mjs` (seuil seulement : 40 vers 42).
- Aucun marqueur de saut ni de focus, aucun commentaire d'ignore de couverture ajouté (contrôle du script
  d'intégrité, vert).

### Mêmes tests exécutés (L14-16, point 3)

`TURBO_FORCE=true pnpm check`, après `pnpm db:down`, code 0, 11 tâches sur 11 sans cache.

| Paquet | Projet | fe4ddff | d8fcc8c | Référence |
|---|---|---|---|---|
| contrats | unitaires | 220 | 220 | 220 (develop) |
| API | unitaires | 430 | 430 | 430 |
| API | e2e | 764 | 764 | 758 + 6 ajoutés (template-database, vérifié : `vitest run test/db/template-database.e2e-spec.ts` = 6) |
| front | unitaires et composants | 682 | 758 | 758 (develop b3ca884, compte rendu F3a) |
| front | parcours Playwright | 252 | 448 | 448 (develop b3ca884) |
| hooks | `node --test` | 768 | 768 | |
| husky | `node --test` | 13 | 13 | |

Couverture « All files » : 100 / 100 / 100 / 100 pour contrats, API et front. Étapes `format:check`,
`lint:workflows` (actionlint), `lint:shell` (shellcheck) vertes dans `check` ; `pnpm lint:shell` et
`pnpm lint:workflows` rejoués à part : code 0.

Durée au mur : **245 s** à fe4ddff (premier passage). Sur d8fcc8c, **369 s** (le front a gagné 196 parcours
avec F3a : 448 parcours en 2,5 min). Écart de procédure : j'ai donc lancé deux `pnpm check` (un par commit
examiné), pas un seul, parce que la branche a bougé en cours de recette. La RAM n'a pas été mesurée. Les e2e
de l'API seuls : 20 s (`pnpm exec vitest run --project e2e`, 764 tests, 55 fichiers) contre 254 s sur
71ff6b5 (log du lead). Note : `npx vitest` (Node 22 de l'hôte) fait échouer les e2e (`process.exit`) ; il faut
passer par `pnpm exec` (Node 26).

Les hooks tests passent aussi sans identité git ni configuration globale (`HOME` vide,
`GIT_CONFIG_GLOBAL=/dev/null`) : 768 sur 768, ce qui réduit le risque d'un échec propre au runner CI.

### Fusion d8fcc8c (F3a)

- `apps/web` et `packages` identiques à b3ca884 (`git diff b3ca884 d8fcc8c` vide hors lot 14).
- `ci.yml` : `git diff fe4ddff d8fcc8c` n'ajoute que les `env` de F3a (`NUXT_CV_SOURCE: fixtures`,
  `NUXT_PUBLIC_CONTACT_EMAIL: contact@example.org`) sur `pnpm build` du job `qualite` et sur l'étape `turbo run
  lint typecheck test:coverage test:e2e` du job `front`, identiques au diff de develop (71ff6b5 vers b3ca884).
  Le `pnpm test` du job `qualite` reste retiré, par L14-16 (déjà couvert par `test:coverage` des jobs `e2e` et
  `front`) ; aucune étape perdue. `dev-front.md` et `revue-a11y.md` modifiés par F3a : section « Git et
  garde-fous » toujours identique (voir point 4), test de concordance vert dans les 768.

### Section « Git et garde-fous » (point 4)

`awk` de la section sur les 14 fichiers puis `md5sum` : une seule empreinte (14 sur 14). Le diff des fichiers
d'agents ne contient que 31 ajouts et 0 suppression chacun. Elle énonce commits atomiques, compte rendu, puis les
refus (push, `main`, étiquettes, `branch -u`, `stash` nu, `--no-verify`/`HUSKY=0`/`core.hooksPath`, worktrees,
scripts et autorisations) et la conduite face à un refus. Aucune description du fonctionnement des détections.
Remarque : elle cite les moyens de contournement refusés (`HUSKY=0`, `core.hooksPath`) ; ce sont des règles
et non des mécanismes de détection, mais Julien peut juger que c'est trop explicite avant publication.
Concordance avec les refus effectifs : couverte par `agents-git-section.test.mjs` (vert).

### Tickets (point 1)

Critères de chaque ticket rejoués par les tests du lot, tous dans le `pnpm check` vert (hooks 768, husky 13,
`integrity:test` : 200 lignes `ok`, 0 `FAIL`) :

- L14-01 : `stryker-directive-write.test.mjs`. L14-02 : `stryker-directive-line.test.sh`, `stryker-citation.test.sh`,
  `stryker-mutator.test.sh`, `stryker-disable.*`. L14-06 : `main-branch.test.mjs`, `main-commit.test.mjs`.
  L14-07 : `ordinary-commands.test.mjs`. L14-11 : `marker-chain.test.mjs` et `.sh`. L14-12 : `test-widening.test.mjs`.
  L14-13 : `worktree.test.mjs`. L14-14 : `agents-git-section.test.mjs`. L14-17 : `branch-upstream.test.mjs`.
  L14-09 : `.husky/tests/check-staged-format.test.mjs` (13 tests) et `format:check` dans `check`.
  L14-08 et L14-10 : `lint:workflows` et `lint:shell` (code 0), `static-analysis.test.sh`.
  L14-15 : e2e en parallèle, `template-database.e2e-spec.ts` (6 tests). L14-16 : décomptes ci-dessus.
  L14-03 : seuil 42 dans `stryker.config.mjs`, `ci.yml` (voir « premier run CI »). Non rejoué : le
  mutation Stryker complet (hors périmètre demandé).
- Le test `agents-git-section` et les tests de hooks sont écrits par l'auteur : je n'ai pas rejoué de recette
  de réserve (étapes 5 et 6 : retrait d'un test au hasard, scénarios OpenAPI), non demandée dans ce brief et
  sans changement de code applicatif dans ce lot.

### Processus (point 6)

- 46 commits de lot, Conventional Commits en français, trailer présent ; aucun push (aucune autorisation de push
  dans le journal, aucune trace sur `origin`). Ajout de `7afd16f` (Turborepo 2.11.13) fait par l'orchestrateur :
  hors tickets mais limité à `package.json` et au lockfile (30 lignes, rien d'autre que turbo).
- Autorisations du lot (journal, fichier en lecture) : fd2ba1f4 (dev-api, tests, `apps/api/test/support/**`),
  76c90a2a, e7aaee4a, d53f8482 (lead-architecte, config : hooks, scripts/ci, agents), fc244fc2 (lead-architecte :
  vitest e2e, `.husky`, `turbo.json`), aa129ef0 et d5232400 (dev-devops : CI, scripts/ci, stryker, husky). Toutes
  révoquées. Les chemins modifiés sous chaque autorisation restent dans ses chemins déclarés.
- Écart de rôle : la décision de Julien désignait le correcteur pour modifier `guard.test.mjs` et les deux tests
  `stryker-disable.*` ; c'est le lead-architecte, sous e7aaee4a, qui les a modifiés. Substance conforme
  (les modifications sont exactement celles décidées), rôle différent.
- Refus du journal (agents du lot, depuis 19:16) : 30 refus environ, quasiment tous des écritures opaques ou
  scripts écrits puis lancés dans la même commande, réécrits sans contournement. Deux points : (a) lead-architecte,
  20:15:34 `git commit --no-verify` refusé puis 20:15:43 `git config … core.hooksPath` refusé : consigné
  au compte rendu (erreur dans un clone jetable, commit refait sans l'option) ; le second refus est une lecture
  (`--get`) que les hooks ont refusée avec le motif « changer core.hooksPath » : faux positif de lecture, pas
  de contournement. (b) 21:20 `git config` sur `branch.*` puis `git push` dans du code `python3` : une
  édition de `shell.mjs` dont le texte contenait des commandes git, lue comme un push caché ; remplacée par
  l'outil Edit. Pas de tentative répétée du même refus.
- Aucune violation de fin de tâche pour les agents du lot dans le journal (les violations relevées sont celles de
  la session front, ignorées).
- Sorties honorables bien consignées : L14-06 (commit sur `main`), L14-02 (citation de l'identifiant), points
  ouverts 1 à 3 repris par l'orchestrateur ; comptes rendus à jour.
- Cycles édition-test : non mesurés sur transcription (non fournie) ; `git log --name-only` ne montre pas de
  fichier de code retouché de façon anormale.

## Seuil de mutation de l'API (point 5)

Scores : 45,64 % à 15 processus, 42,03 % à 6, soit une marge de 0,03 point au seuil 42. Le nombre de timeouts,
comptés détectés, varie avec la charge (57 contre 20) : moins de charge, donc moins de timeouts, donc un score
plus bas. Un exécuteur CI à 2 ou 4 cœurs, moins chargé qu'une machine partagée, peut descendre sous 42 sans
aucun changement de code. De plus, en mode incrémental le score total repose sur le cache restauré.

**Recommandation : 41**, à relever à 42 (ou plus) après le premier run complet sur étiquette `v*` si le score
mesuré en CI le permet. La règle « relevé au score obtenu » n'est pas violée : 41 relève toujours 40, et
elle demande d'abord un score stable, que 0,03 point ne garantit pas. Un seuil rouge sans régression de code
fait perdre plus que le point d'oracle. C'est à Julien de trancher.

## Réserves

1. Durée : 369 s de `pnpm check` sur d8fcc8c, dominée par le front (448 parcours, `web#lint` sur le chemin critique,
   point ouvert 1 du lead : lot F11). RAM non mesurée.
2. Section des agents : cite `HUSKY=0` et `core.hooksPath` comme gestes refusés (voir ci-dessus).
3. Rôle (lead-architecte au lieu du correcteur) pour trois tests existants ; consigné, décision conforme.
4. Faux positif des hooks sur `git config --get core.hooksPath` (lecture refusée), contraire à CLAUDE.md qui
   dit que les lectures `git config --get` restent permises ; à examiner.
5. La limite de `rebase.updateRefs` et la non-couverture de `git branch -t` / `checkout -b` suivant une branche
   distante sont déjà documentées par le lead.
6. Les étapes 5 et 6 du processus de recette (retrait d'un test au hasard, scénarios de réserve OpenAPI) n'ont
   pas été faites pour ce lot, faute de demande.

## À ne vérifier qu'au premier run CI

1. Job `mutation` : clé et restauration du cache (`stryker-incremental-` en préfixe, PR depuis la branche de base),
   enregistrement même en échec, passage de `-- --incremental` par Turborepo à `stryker run` (le `--dry=json` ne
   montre pas les arguments), durée de l'incrémental, score total comparé à 42.
2. Déclencheur `tags: ['v*']` et sur une étiquette le job `garde-fous` : base `origin/develop` (`BASE_REF` par défaut).
3. Job `analyse-statique` : tirage des images actionlint et shellcheck par digest sur le runner.
4. Job `qualite` : `husky:test` sans `pnpm test`, avec les variables d'environnement de F3a au build.
5. Job `e2e` : parallélisme des e2e de l'API avec le nombre de cœurs du runner (une base par processus) et
   `pnpm turbo run test:coverage --filter=!@siteperso/web` ; temps de la tâche.
6. Job `garde-fous` : `node --test` des hooks sur le runner (les tests créent des dépôts git temporaires ; vérifié
   sans identité globale en local).

## Questions pour Julien

1. Le seuil de mutation de l'API : 41 (ma recommandation) ou 42 ?
2. La section « Git et garde-fous » peut-elle garder la mention de `HUSKY=0` et `core.hooksPath` avant la publication
   du dépôt ?
3. Faut-il faire autoriser par les hooks la lecture `git config --get core.hooksPath` (aujourd'hui refusée) ?
4. Le lot est-il fusionné tel quel dans `develop` avec la réserve de durée (369 s), ou le chemin critique du front
   (point ouvert 1 du lead) passe-t-il dans le lot F11 ?
