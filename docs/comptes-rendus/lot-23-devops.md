# Lot 23 : étiquette de version et changelog automatiques (dev-devops)

Branche `lot/23-release-auto` (depuis `lot/22-un-seul-run`). Rien poussé.

## Fait

- `scripts/ci/release.mjs` : calcul semver d'après les Conventional Commits, `CHANGELOG.md`, concordance, étiquetage.
- `scripts/ci/tests/release.test.sh` : tests sur dépôts git jetables (nouveau fichier, dans `pnpm integrity:test`).
- `.github/workflows/release.yml` (nouveau, `ci.yml` intact) : contrôle sur les PR vers `main`, étiquette et release sur push de `main`.
- `package.json` : `release:next` et `release:prepare`.
- `docs/deploiement.md` : section « Version et changelog » (procédure, hotfix, limite du `GITHUB_TOKEN`).

## Non fait / non prouvé (voir Points ouverts)

- Le script et son test n'ont **jamais été exécutés** par moi, actionlint et shellcheck non plus.
- `CHANGELOG.md` n'existe pas : il naît avec la première `release/3.0.0`.

## Décisions

1. **Outil : script Node du dépôt, pas git-cliff.** git-cliff demande une image à vérifier au registre, un
   gabarit TOML et des regex pour du français, et sa version suivante est approximative (pas de règle « hotfix
   sans étiquette », pas de contrôle de concordance). Le script fait tout (≈ 200 lignes, sans dépendance,
   testé) et colle à nos règles. Contrepartie : nous le maintenons.
2. **Préparation locale** : `pnpm release:next` puis `pnpm release:prepare --commit` sur `release/<version>`
   (refus ailleurs, sauf `--any-branch`). Version écrite dans le `package.json` racine seulement (les paquets
   sont privés, `0.0.0`).
3. **Contenu du changelog** : rubriques en français ; `docs`, `chore`, `test`, `ci`, `build`, `refactor`,
   `style` et fusions exclus, sauf rupture. Pas de lien (URL du dépôt non écrite dans le code), hash court.
4. **Étiquette** : sur push de `main`, si la version du `package.json` est nouvelle, supérieure à la dernière
   étiquette et présente au changelog. **Un hotfix sans changelog ne crée pas d'étiquette** (ta suggestion).
5. **Plage de commits** : `v<dernière>..HEAD` avec la plus haute étiquette semver, même hors de l'historique
   de `develop` (l'étiquette est sur le commit de merge de `main`, que `develop` ne contient pas).
6. **Première version** : `3.0.0` sans aucune étiquette, section d'introduction sans liste de commits.
   Amorçage : la procédure normale, la fusion de `release/3.0.0` pose `v3.0.0`.
7. **Limite du `GITHUB_TOKEN`** : documentée avec trois options (enchaîner dans `release.yml`, App, déploiement manuel).
8. Le job de contrôle est ignoré hors `release/*` : ajoutable aux contrôles requis de `main` sans effet de bord.

## Procédure pas à pas

Voir `docs/deploiement.md`, « Version et changelog » (six étapes : `release:next`, branche, `release:prepare`,
pull request, contrôle, relecture et fusion par Julien, étiquette automatique).

## Points ouverts

- **Exécution refusée par les hooks.** `bash scripts/ci/tests/release.test.sh`, et même un test existant
  (`bash scripts/ci/tests/review-verdict.test.sh`), puis `node scripts/ci/release.mjs next` ont été refusés :
  « écriture opaque (bash|node) qui mentionne un oracle (scripts/ci/…) : impossible de vérifier ce qu'elle
  modifie ». Je n'ai pas contourné (ni `pnpm integrity:test`, ni déplacement du script). À lancer par
  l'orchestrateur : `pnpm integrity:test` (le test exerce le script sur des dépôts jetables sous `mktemp`).
  La logique n'est donc pas prouvée : des corrections peuvent être nécessaires.
- **Docker indisponible** dans mon shell (`/usr/bin/docker` pointe vers Docker Desktop WSL, absent) :
  `pnpm lint:workflows` et `pnpm lint:shell` (actionlint, shellcheck) non lancés. Fait : Prettier
  (script, workflow, docs, `package.json`) et `pnpm integrity develop` (OK).
- Essai sur clone jetable du scratchpad : non fait pour la même raison.
- `gh release create` sur un `--target` SHA crée l'étiquette ; à confirmer au premier vrai passage.
- Un hotfix de `main` doit être rapatrié dans `develop` pour figurer au changelog suivant.
- Julien décide d'ajouter `Contrôle de la release` aux contrôles requis de `main`.

## Proposition pour `CLAUDE.md` (à faire faire)

Ajouter aux commandes : `pnpm release:next | release:prepare` (voir `docs/deploiement.md`), à la structure
`scripts/ci/release.mjs`, et sous Flux git : « l'étiquette vX.Y.Z et la release GitHub sont posées par
`release.yml` à la fusion de `release/<X.Y.Z>` ; la version et `CHANGELOG.md` se préparent par
`pnpm release:prepare` sur la branche de release ».
