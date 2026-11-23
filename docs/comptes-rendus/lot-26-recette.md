# Lot 26 : recette (chef de projet, 23 nov. 2026)

Branche `lot/26-suites-revues`, tête `cf8716d`, PR #14 vers `develop`. Vérifications ciblées (règle D26) :
ni `pnpm check` ni mutation complète.

## Verdict : acceptée, avec un ticket partiel (L26-04) et trois réserves de preuve

## Critères, ticket par ticket

La section « Lot 26 » annoncée dans `docs/backlog.md` n'existe pas (aucune occurrence de `L26-0` ni de
« Lot 26 » dans le fichier, sur la branche comme dans le checkout principal). Les tickets et leurs critères
ont donc été reconstitués depuis les comptes rendus `lot-26-devops.md` et `lot-26-lead.md` et depuis les
messages de commit. Point ouvert : l'écrire au backlog.

| Ticket | Contenu | Preuve rejouée | Résultat |
| ------ | ------- | -------------- | -------- |
| L26-01 | `persist-credentials: false` sur tous les checkouts | `git diff develop...HEAD -- .github/workflows/ci.yml` : présent sur les 10 checkouts (qualité, garde-fous, e2e, front, parcours, analyse statique, mutation, image Docker, pile locale) | OK |
| L26-02 | Arrêt au premier échec par un job de surveillance, plus d'étapes `if: failure()` ; `actions: write` retiré des jobs de contrôle | Diff : 8 étapes retirées, `actions: write` seulement sur `arret-premier-echec`. Job présent et vert dans le run 45154790264 (tentative 2). Preuve de l'annulation : tentative 1 du même run, job « Front parcours (ultra-3440) » `failure` à 10:23:28, job « Arrêt au premier échec » `cancelled` à 10:23:47, « Revue PR » `skipped`, conclusion du run `cancelled` ; le job fautif reste en échec (non « annulé »), les autres jobs étaient déjà terminés, le seul job encore en cours (la surveillance) a été annulé avec le run | OK |
| L26-03 | Contrôle de cohérence matrice `front-parcours` / viewports Playwright | Script lu (`scripts/ci/check-front-matrix.mjs`), étape ajoutée au job `garde-fous`, qui est vert sur la tête ; la matrice du workflow compte les 7 écrans attendus (390, 834, 1024, 1280, 1440, 1920, 3440) | OK (voir réserve 1) |
| L26-04 | `release.mjs prepare --commit` refusé sur `main` ; `check` qui régénère la section du CHANGELOG | Refus sur `main` : diff lu, test `release-main.test.sh` présent, exécuté par le job `garde-fous` (vert). Régénération par `check` : non faite | Partiel |
| L26-05 | Élagage de l'état des garde-fous (relevés d'écritures autorisées en fichiers, `pruneState`, `revoked_at`) | Diff lu (`lib/state.mjs`, `guard.mjs`, `authorize.mjs`, README), 21 tests nouveaux dans `tests/state-prune.test.mjs`, aucun test existant modifié. Le job CI « Garde-fous (…, hooks des agents) » est vert | OK (voir réserve 1) |
| L26-06 | Consommation de la revue dans le résumé du run | `review-usage.mjs` et `review-usage.test.sh` ajoutés, étape `if: always()` dans le job de revue, `docs/deploiement.md` mis à jour ; job « Revue PR (Claude) » vert | OK (voir réserve 1) |
| L26-revue | Constats non bloquants de la revue (surveillance tolérante à l'API, `timed_out`, aide de `release.mjs`) | Diff : trois tentatives par lecture, avertissement sans job rouge, `timed_out` ajouté | OK (voir réserve 2) |

## Réserves de preuve

1. **Exécution des scripts par moi impossible.** Les garde-fous ont refusé, sans que je les contourne :
   `bash scripts/ci/tests/<test>.test.sh` (raison : « écriture opaque (bash) qui mentionne un oracle
   (scripts/ci/check-front-matrix.mjs) »), `node scripts/ci/check-front-matrix.mjs` (« écriture opaque (node)
   qui mentionne un oracle (apps/web/playwright.config.ts) »), `node --test
   .claude/hooks/tests/state-prune.test.mjs` (« les scripts des garde-fous ne se lancent que depuis la
   session principale »), et une boucle `for` sur `scripts/ci/tests/*.test.sh` (variable non lisible).
   Je cherchais à rejouer ces tests et le contrôle de matrice. Substitut : le job CI `garde-fous` du run
   45154790264 (tête `cf8716d`) lance précisément ces tests et le contrôle de matrice, et il est vert ; la
   suite des hooks est lancée par la CI (`pnpm hooks:test`). L'orchestrateur peut rejouer
   `pnpm integrity:test` et `pnpm hooks:test` depuis la session principale si une preuve locale est voulue.
2. **Pas de défaillance réelle de l'API testée** pour la tolérance de la surveillance ajoutée dans le dernier
   commit (`cf8716d`) : seulement le passage nominal (tentative 2, « Tous les jobs surveillés sont terminés
   sans échec »). Le constat `timeout-minutes: 45` de la revue reste tel quel (le job de surveillance a duré
   4 min 18 s sur le run complet).
3. **Le backlog ne décrit pas le lot** (voir plus haut).

## Intégrité des tests

- `pnpm integrity develop` : « Intégrité des tests : OK », code 0.
- Diff : aucun test existant modifié ou supprimé. Fichiers modifiés ou supprimés : README, `authorize.mjs`,
  `guard.mjs`, `lib/state.mjs`, `ci.yml`, `deploiement.md`, `release.mjs`, deux patchs de comptes rendus
  retirés (`lot-22-lead-release.patch`, `lot-25-lead-l25-05.patch`, déjà appliqués). Fichiers de test
  ajoutés : `state-prune.test.mjs`, `front-matrix.test.sh`, `release-main.test.sh`, `review-usage.test.sh`.
- Dix lignes `Justification-test` (L26-01 à L26-06, L26-revue), toutes en rapport avec une configuration ou
  un garde-fou protégés ; chacune précise qu'aucune étape de test n'est retirée ni conditionnée.
- Recherche de marqueurs de saut ou de focus et de commentaires d'ignore dans le diff : non lancée (refus de
  la commande de recherche contenant ces motifs) ; couverte par `pnpm integrity`, vert.
- Oracle CI : `ci.yml` est modifié, mais les étapes de test, couverture et mutation sont conservées ; seul
  le mécanisme d'arrêt change. `permissions` réduit, pas élargi.

## Journal des garde-fous (depuis le 22 nov. 20 h)

- dev-devops : 12 écritures autorisées (grants `e7fcaa43` L26-06 et `33032d46` L26-revue, tous deux
  révoqués), aucun refus.
- lead-architecte : 14 écritures autorisées (grant `6e8b8dcb` L26-hooks, révoqué), un refus (lancer un script
  des garde-fous, 09:55 ; pas de tentative de contournement, travail poursuivi par `pnpm hooks:test`).
- main : un grant `6a9968b5` BF-15 (utilisé puis révoqué), un refus de commande illisible.
- qa-front : 7 refus (écritures opaques via node et python3 sur `apps/web`, chemin de cache) : hors périmètre
  du lot 26 (parcours de l'accueil), à voir côté front.
- chef-de-projet : 6 refus pendant cette recette (détaillés en réserve 1).
- Violations de fin de tâche : aucune relevée pour les agents du lot.

## Cycles édition-test

`git log --name-only develop..HEAD` : fichier le plus touché `ci.yml` (3 commits), puis `release.mjs`,
`deploiement.md`, `state.mjs` (2 chacun). Aucun fichier au-delà de 5 cycles. Transcription non fournie : le
nombre d'alternances édition/test n'est pas mesuré.

## Retrait d'un test au hasard et tests de réserve

- Retrait aléatoire : inapplicable. Le lot ne touche aucun fichier mesuré par `pnpm test:coverage` (hooks,
  scripts CI, workflow, docs) ; ce seuil de 100 % ne s'applique pas à ces fichiers. Non fait.
- Tests de réserve OpenAPI : inapplicables, aucune route ni schéma modifié. 0 scénario, 0 échec.

## CI

- Run 45154790264, tête `cf8716d`, tentative 2 : `success`, 19 jobs verts, dont « Arrêt au premier échec »,
  garde-fous, qualité, e2e, front, 7 parcours, mutation, pile locale, revue. Tentative 1 : échec du parcours
  ultra-3440 (le test `experience.e2e.ts:680`, signalé instable du front, hors lot), arrêt du run par la
  surveillance (preuve de L26-02). Run précédent 45153308122 sur `b9873ed` : `success`.
- Revue `revue-pr` : `VERDICT: OK`, d'après l'orchestrateur (non relu par moi).

## Décisions à demander à Julien

1. L26-04 : faut-il retirer ou adapter, sous `Justification-test`, le cas de `release.test.sh` (« commit ajouté
   sans changer la majeure, concordant ») pour que `check` régénère la section du CHANGELOG, ou renoncer à
   cette comparaison ?
2. Les reports de tests des garde-fous sont retirés après 7 jours (`CARRY_MAX_AGE_MS`) : cette durée
   convient-elle ?
3. Le test instable `experience.e2e.ts:680` (écran 3440) doit-il devenir un ticket du front ?

## Non fait

- Régénération du CHANGELOG par `check` (L26-04, sortie honorable du dev-devops, voir décision 1).
- Section « Lot 26 » du backlog.
- Exécution locale des tests de scripts et de hooks (refus des garde-fous, voir réserve 1).
