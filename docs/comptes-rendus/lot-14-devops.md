# Lot 14, étape c (dev-devops) : CI et outillage

Tickets : L14-03, L14-08, L14-10, suites de l'étape b, versions. Date : 20 nov. 2026. Pas de push.

## Fait

- **L14-08 actionlint, L14-10 shellcheck** : `scripts/ci/static-analysis.sh workflows|shell`, lancé par
  `pnpm lint:workflows` et `pnpm lint:shell` (insérés dans `pnpm check` après `format:check`) et par le
  job CI `analyse-statique`. Images Docker épinglées par digest. Test : `scripts/ci/tests/static-analysis.test.sh`
  (paramètres refusés, simulation `SIMULATION=1`, digests). actionlint refuse un workflow invalide
  (événement inconnu, propriété d'expression inconnue, SC2086 d'un `run:`), démontré sur un faux dépôt.
  - **SC1112** : écarté seulement pour `scripts/ci/tests/{fails-marker,paths,stryker-directive-line}.test.sh`
    (appel shellcheck séparé, `-e SC1112`) : tests protégés, guillemets typographiques voulus dans des
    libellés français. Tout le reste est analysé sans exclusion ; aucun autre avertissement, aucune
    directive `shellcheck disable`. `.husky/pre-commit` : `--shell=sh`. Rien relevé dans
    `check-tests-integrity.sh` ni les hooks (non modifiés).
- **L14-03 mutation** : déclencheur `tags: ['v*']` ; hors étiquette, `turbo run test:mutation --concurrency=1 -- --incremental`
  avec `actions/cache/restore` et `save` (`always()`) des trois `reports/stryker-incremental.json` ; sur
  étiquette, `pnpm test:mutation` complet. Les seuils `break` s'appliquent au score total dans les deux
  modes : l'incrémental ne peut en abaisser aucun. Vérifié : `--dry=json` transmet `--incremental` aux trois `stryker run`.
- **Seuil API** : `break` et `low` de 40 à 42 (f155d27), voir mesures.
- **Suites de l'étape b** : `pnpm husky:test` ajouté au job `qualite` ; doublons retirés (voir listes).
- **Turborepo** 2.11.12 vers 2.11.13 (confirmé `pnpm view turbo version`), lockfile commité.

## Versions et digests vérifiés

- actionlint 1.7.12 (30 mars 2026, dernière) : `sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667`
- shellcheck v0.11.0 (4 août 2025, dernière) : `sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d`
- actions/cache v6.1.0 (26 juin 2026, dernière) : SHA `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (`git ls-remote`, tag v6.1.0).
- Digests relevés par `docker pull` (index multi-architecture). SHA des autres actions inchangés.

## Mesures de mutation de l'API

| Mesure | Concurrence Stryker | Durée | Score total | Couvert | Tués / timeouts / survivants / sans couv. |
|---|---|---|---|---|---|
| 1 | 15 processus (8 vérificateurs + 7 lanceurs, 16 cœurs) | 19 min 20 | 45,64 % | 73,03 % | 398 / 57 / 168 / 374 |
| 2 | `--concurrency 6` (3 + 3) | 17 min 52 | 42,03 % | 67,26 % | 399 / 20 / 204 / 374 |

Les deux scores dépassent 42 : `break` = 42 (minimum 42,03 %). Les mesures ne sont pas identiques :
la charge change le nombre de timeouts (57 contre 20), comptés détectés ; sous faible concurrence moins de
mutants dépassent le délai et ils tombent survivants, donc le score baisse. Le minimum est 42,03 % pour
un seuil de 42 : marge de 0,03 point, fragile sur un exécuteur GitHub à 2 ou 4 cœurs (point ouvert 1).

## Tests exécutés par job CI, avant et après

| Job | Avant | Après |
|---|---|---|
| `qualite` | `pnpm test` : unitaires contrats, API (unit), front (unit + nuxt) | `pnpm husky:test` (nouveau) ; plus de `pnpm test` |
| `garde-fous` | hooks, `integrity:test`, intégrité | inchangé |
| `e2e` | `test:coverage` des trois paquets (contrats unit, API unit + e2e, front unit + nuxt), puis e2e API en ordre aléatoire | `test:coverage` contrats et API (front exclu), puis e2e API en ordre aléatoire |
| `front` | lint, typecheck, `web#test:coverage`, `web#test:e2e` | inchangé |
| `analyse-statique` | n'existait pas | actionlint, shellcheck |
| `mutation` | `pnpm test:mutation` | incrémental, ou complet sur `v*` |

Aucune perte : unitaires contrats et API exécutés dans `e2e` (projets unit et e2e du `test:coverage`) ;
unitaires et composants du front dans `front` (`web#test:coverage` exécute `vitest run`, les deux projets,
avec couverture). Graphe du filtre vérifié par `--dry=json` : `contracts#build`, `contracts#test:coverage`,
`api#test:coverage`.

## Décisions

- Script unique `static-analysis.sh` pour l'hôte et la CI (une seule source des digests).
- Cache en `restore` + `save` séparés, pour enregistrer l'incrément même quand le job échoue.
- Commit de la CI sous `Justification-test: L14-03` (changement de ce que lance la CI, aucune étape retirée sans équivalent).

## Non fait / points ouverts

1. Seuil 42 à marge de 0,03 point : à surveiller au premier run de CI (peut échouer par timeouts moindres).
2. À vérifier au premier run réel : clé et restauration du cache de l'incrément (préfixe `stryker-incremental-`,
   PR lisant la branche de base), enregistrement même en échec ; déclencheur `v*` ; sur une étiquette, le job
   `garde-fous` compare à `origin/develop` (base vide) : résultat à confirmer ; durée de l'incrémental.
3. Les hooks refusent d'exécuter un script écrit dans la même commande et `bash scripts/ci/static-analysis.sh` lancé directement (normal, confirmé) : passer par `pnpm lint:*`.

## Vérification finale

`TURBO_FORCE=true pnpm check`, chacun après `pnpm db:down`, l'un après l'autre : 1) vert, 290 s au mur ;
2) vert, 337s au mur. `pnpm db:down` fait en fin de tâche, aucun processus
stryker, vitest ou turbo restant. Aucun test existant ni oracle modifié.

## Complément après la fusion des deux branches (HEAD a0d5686)

SC1112 : la liste nominative de trois fichiers est remplacée par le motif `scripts/ci/tests/*.test.sh`
(les tests venus de la branche des garde-fous, `stryker-mutator.test.sh` et peut-être `stryker-citation.test.sh`,
l'émettent aussi). L'exclusion reste limitée aux tests protégés, sans liste à tenir à jour ; les autres scripts
sont analysés sans exclusion. Vérifié : `pnpm lint:shell`, `pnpm lint:workflows`, `pnpm integrity:test`, `pnpm hooks:test`.
