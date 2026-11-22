# Lot 23 : recette (chef-de-projet), 22 nov. 2026

Branche `lot/23-release-auto`, tête `f0b64d8`, PR #10. D26 révisée : la CI est la vérification complète, pas de `pnpm check`.

## Verdict : acceptée, avec réserves (aucune bloquante)

## Preuves

- **CI** : run 45025391947 sur `f0b64d8` (tête de la branche), conclusion `success` ; jobs « Analyse statique » et « Qualité » verts.
- **Revue automatisée** : `VERDICT: OK`, deux constats non bloquants (évalués plus bas).
- **Oracles** : `pnpm integrity develop` -> « Intégrité des tests : OK ». Diff des tests : un seul fichier de test, `scripts/ci/tests/release.test.sh`, créé dans le lot. Le seul commit qui le modifie (2acc1ec, `cut -c1-9` -> `cut -c1-10`) porte `Justification-test: L23-03` ; l'attendu (`## [4.0.0]`) est inchangé, le défaut était dans le test neuf. Aucun test préexistant touché, aucun skip/only, `ci.yml` intact (absent du diff).
- **Vérifications légères** (worktree, lecture seule) : `pnpm integrity:test` OK (dont `release.test.sh` : 13 réussis, 0 échoué ; cas « section 4.0.0 avant 3.0.0 » vert) ; `pnpm lint:workflows` et `pnpm lint:shell` sans erreur.
- **Garde-fous** : autorisation 13644d3e (dev-devops, scope config, `.github/workflows/**` et `scripts/ci/**`) accordée, utilisée sur `ci.yml` (3 fois, le fichier n'est finalement pas dans le diff), puis révoquée. Pas de tentative répétée de contournement (l'agent s'est arrêté sur les refus de lancement et l'a consigné).

## Conformité à la décision du 21 nov.

- Aucun robot n'écrit sur `main` ni sur la branche de release : `release.yml` ne fait aucun `git push`/commit ; `prepare --commit` est lancé par la session principale. Conforme.
- Étiquette posée uniquement par `release.yml` (job `etiquette`, `gh release create --target $GITHUB_SHA`, sur `push` de `main`). Permissions : `contents: read` au niveau workflow, `contents: write` au seul job `etiquette` ; checkout `persist-credentials: false` ; `concurrency` sans annulation. Conforme.
- Hotfix direct sans changelog : `should-tag` exige section au CHANGELOG, version non étiquetée et supérieure à la plus haute étiquette ; test `release.test.sh` « hotfix sans mise à jour du changelog : pas d étiquette » vert. Conforme.
- Version de départ `3.0.0` (`FIRST_VERSION`, sans étiquette existante) ; test `should-tag : 3.0.0 à étiqueter` vert. Conforme.
- Limite du `GITHUB_TOKEN` (étiquette sans déclenchement d'autres workflows) : documentée dans `release.yml` et `docs/deploiement.md` (l. 486-491, trois options). Conforme.
- `CLAUDE.md` : commandes, structure et flux git mis à jour de façon cohérente.

## Non fait / limites de la recette

- **Essai direct de `release:next` et `release:prepare` sur un clone jetable : non fait.** La commande `node scripts/ci/release.mjs …` lancée depuis le clone du scratchpad a été refusée par le hook (« script de node illisible (scripts/ci/release.mjs) : absent, pas un fichier ou plus de 512 Ko », chemin relatif résolu hors du cwd du hook). Je n'ai pas reformulé. Suppléé par `release.test.sh`, qui exerce `next`, `prepare`, `check`, `notes`, `should-tag` sur des dépôts git jetables (section 4.0.0 à quatre rubriques, rejeu sans doublon, trailer, refus hors `release/<v>`). Le changelog réel n'a donc pas été constaté de mes yeux sur le dépôt ; à l'orchestrateur de décider si l'essai manuel au premier `release/3.0.0` suffit (la PR de release sera relue par Julien de toute façon).
- Tests de réserve OpenAPI, retrait aléatoire de test, cycles édition-test : sans objet pour ce lot (aucun code d'API ni de test applicatif touché ; couverture portée par la CI).
- Non prouvé avant le premier passage réel : `gh release create --target <SHA>` crée bien l'étiquette `vX.Y.Z` (signalé par l'agent).

## Les deux constats de la revue

1. **`check` ne vérifie que la présence de la section** (pas son contenu). Priorité **basse à moyenne**. Un changelog périmé (commit `feat` ajouté à `develop` après `prepare`) passe le contrôle, mais la version calculée est elle aussi comparée à la branche et au package.json, donc un nouveau `feat` qui changerait la version est détecté ; seul un `fix` supplémentaire sous la même version échappe. Julien relit la PR. Amélioration possible, hors lot : régénérer la section en mémoire et comparer au fichier.
2. **`prepare --any-branch --commit`**. Priorité **basse**. L'option existe pour le hotfix ; elle permet de committer sur n'importe quelle branche, `main` comprise, mais le hook interdit tout `git commit` sur `main` et aucun robot ne l'appelle. Durcissement possible : refuser `--commit` si la branche courante est `main`.

## Décisions à demander à Julien

- Ajouter « Contrôle de la release » aux contrôles requis de `main` ? (le job est ignoré hors `release/*`, donc sans effet de bord.)
- Accepter la limite du `GITHUB_TOKEN` pour l'instant (aucun déploiement sur étiquette avant L14-05) ?

## Points ouverts

- Un hotfix de `main` doit être rapatrié dans `develop` pour figurer au changelog suivant (déjà documenté).
- `CHANGELOG.md` naîtra avec `release/3.0.0`.
