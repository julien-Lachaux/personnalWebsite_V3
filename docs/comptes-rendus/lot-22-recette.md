# Recette du lot 22 (chef-de-projet, 22 nov. 2026)

PR #7, branche `lot/22-un-seul-run`, tête examinée 117253b. Règle D26 révisée : l'unique vérification
complète est la CI de la PR ; aucun `pnpm check` lancé. Rien poussé.

## Verdict : ACCEPTÉE, avec deux réserves à lever par Julien (ci-dessous)

## Preuves par ticket

| Point | Preuve | Résultat |
| --- | --- | --- |
| Un seul run par PR, aucun au push de la branche | `gh run list --branch lot/22-un-seul-run` : 2 runs, tous `pull_request` (45023770293 sur 117253b, 44938175039 sur f7dbb00) ; aucun `push`. `on:` de `ci.yml` : `pull_request` (develop, main), `push: [main]`, `workflow_dispatch` | OK |
| Arrêt au premier échec | Run 44938175039 (échec) : les 17 jobs requis et mutation en `failure` (annulation par `gh run cancel`, étape `if: failure()` présente dans chaque job requis, `actions: write` limité à ces jobs), `Revue PR` en `skipped` | OK |
| Revue après la CI | `revue-pr` : `needs:` des 8 groupes de jobs requis (qualite, garde-fous, e2e, front-qualite, front-parcours, analyse-statique, docker, pile-locale) ; `skipped` quand la CI échoue (run 44938175039), exécutée et verte sur 117253b ; `revue-pr.yml` supprimé | OK |
| Mutation complète sur PR vers `main` | `MUTATION_FULL = pull_request && base_ref == main` (ci.yml:359) ; étapes incrémentale / complète exclusives. Sur cette PR (base develop) les 3 mutations (contrats, API, front) sont vertes en incrémental | Lu dans le code ; chemin « complet » non exercé faute de PR vers `main` (réserve 2) |
| Front réparti, 7 projets | 7 jobs `Front parcours Playwright + axe (<projet>)`, noms identiques aux 7 `viewports` de `playwright.config.ts`, étape « Génération … parcours » `success` partout, 146 à 207 s chacun (ils ont réellement joué) ; job `Front (lint, typecheck, couverture 100 %)` vert | OK |
| 15 contrôles requis | Jobs du run 117253b : qualité, garde-fous, e2e, front-qualité, 7 parcours, analyse statique, image Docker, pile locale, revue = 15 ; noms comparés ligne à ligne à `docs/deploiement.md` (liste, JSON du ruleset, « quinze noms ») : identiques. Les 3 mutations ne sont pas requises | OK |
| D26 réécrite (L22-01) | Diff de `CLAUDE.md`, `docs/03`, `chef-de-projet.md`, rappels des autres agents : la CI de la PR est l'unique vérification ; section commune « Git et garde-fous » inchangée (`pnpm hooks:test` vert, dont le test d'identité de la section) | OK |
| Hooks (L22-02, L22-05) | `pnpm hooks:test` : 1145 tests, 1145 réussis, 0 échec. `release-flow.test.mjs` (207 lignes) et `run-download.test.mjs` (240 lignes) : cas permis et refusés, rôles d'agents ; refus maintenus (`--squash`, `--rebase`, `--admin`, `--delete-branch`, `--auto`) | OK |
| `turbo.json` (L22-03) | `passThroughEnv: ["TEST_MAX_WORKERS"]` sur `@siteperso/web#test`, seul changement | OK |
| `dev-devops.md` (L22-04) | ne cite plus `.github/dependabot.yml` ; D26 alignée | OK |

Vérifications légères : `pnpm integrity develop` OK ; `pnpm hooks:test` 1145/1145 ; `pnpm integrity:test` 9 réussis ;
`pnpm lint:workflows` sans erreur (et job `Analyse statique` vert en CI).

## Oracles

`git diff --diff-filter=MD develop...HEAD` sur les tests : seuls tests existants modifiés du lot, `git-push.test.mjs:118` et
`pr-flow.test.mjs:154` (beccd03, `Justification-test: L22-02`). Le diff de beccd03 ne change que ces deux lignes ; les cas
remplacés restent des refus (`release/1.0.0:release/2.0.0` refusé, `release/1.0` refusé comme « branche de lot ») : aucune
assertion affaiblie, les cas permis sont couverts par `release-flow.test.mjs`. Le cas `pr-flow.test.mjs:202`
(`gh run download 99` sans `--dir`) reste valide et vert.
Les trois fichiers `apps/web/test/*.e2e.ts` qui apparaissent dans `develop...HEAD` viennent de F5d (merge de PR #8, correcteur
F5D-2, autorisation 56e604c7 et triage) : `develop` local est en retard sur `origin/develop`, ce n'est pas du lot 22.
`pnpm integrity develop` OK. Aucun marqueur de saut ni commentaire d'ignore ajouté.

## Processus

- Autorisations : 6591e036 (devops, `.github/workflows/**`, `scripts/ci/**`) : écritures de `ci.yml` et suppression de
  `revue-pr.yml` seulement, dans ses chemins, révoquée 18:31. 87eb9fbc (lead, `.claude/hooks/**`, `.claude/agents/**`,
  `turbo.json`) : écritures uniquement dans ces chemins, révoquée 18:54. ebfa6efe (main) : les deux seuls tests, révoquée en 1 min.
- Refus du journal : tentatives d'écriture opaque (python, node, script écrit dans la même commande) par devops et lead, non
  rejouées sous une autre forme ; refus du classifieur sur l'édition de `git-push.test.mjs` par le lead, consigné et laissé à
  l'orchestrateur (sortie honorable correcte). Aucune tentative répétée de contournement.
- Aucun `git push` ni écriture `gh` d'agent relevé.

## Constats non bloquants de la revue : évaluation et priorité

1. `persist-credentials` laissé à `true` sur les checkouts des jobs portant `actions: write` (ci.yml ; seul `revue-pr` le met à
   `false`). Vérifié : 18 `actions: write`, 2 `persist-credentials: false`. Un paquet compromis pendant `pnpm install` pourrait
   annuler des runs, déclencher des workflows, vider des caches. Les PR de forks ont un jeton en lecture seule, le risque reste
   interne. Correction triviale (`persist-credentials: false`, l'annulation reçoit `GH_TOKEN`). **Priorité haute**, à faire en tête du lot suivant.
2. Matrice `front-parcours` recopiée à la main des `viewports`. Une taille ajoutée au config ne tournerait plus en CI sans
   signal, et le contrôle requis correspondant n'existerait pas. **Priorité moyenne** : test de cohérence matrice / `viewports`
   (nouveau test, pas de modification d'oracle).
3. Protection de `main` non décrite ni posée : les hooks ouvrent PR et fusion de `release/*` à la session principale, l'accord de
   Julien n'étant qu'une règle de l'orchestrateur. **Priorité haute avant la première release** : ruleset pour `main` (PR
   obligatoire, contrôles requis) documenté dans `docs/deploiement.md`.
4. `docs/comptes-rendus/lot-22-lead-release.patch` (484 lignes) déjà appliqué (9f99811), dupliquant le code. **Priorité basse** :
   le supprimer ou le marquer historique.

## Réserves

1. **Ruleset de `develop` à mettre à jour par Julien avant la fusion** : le contrôle requis `Front (lint, typecheck, couverture
   100 %, Playwright + axe sur 7 tailles d'écran)` n'existe plus ; sans mise à jour, la fusion reste bloquée sur un contrôle
   qui ne se produira jamais. Remplacer par les huit noms du front de `docs/deploiement.md` (quinze au total). Les nouveaux noms ne
   sont proposables qu'après avoir tourné une fois : c'est le cas sur cette PR.
2. Le chemin « mutation complète avec seuils » (PR vers `main`) et les hooks release en conditions réelles ne sont exercés par
   aucun run : ils le seront à la première PR de release. À observer alors.

## Questions fermées pour Julien

- Mets-tu à jour le ruleset de `develop` (quinze contrôles) avant la fusion de la PR #7 ? 
- Poses-tu un ruleset sur `main` avant la première release ?
- Le correctif `persist-credentials: false` passe-t-il en premier dans le lot suivant ?

## Livrables hors périmètre noté

Ce document est le seul fichier ajouté par la recette. Aucun conteneur ni clone créé.
