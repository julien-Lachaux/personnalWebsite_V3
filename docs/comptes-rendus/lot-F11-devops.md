# Lot F11 : mesures du JS en CI (dev-devops, F11-06, D50)

Date : 26 novembre 2026. Branche `lot/F11-optimisation`. Autorisations « config » : 47e75b40 (`ci.yml`),
f2ffec0a (script et son test).

## Fait

- `scripts/ci/front-bundle-budget.mjs` : mesure `_nuxt/*.js` (poids total) et le JS chargé par `/`, `/en` et
  `/accessibilite` (script d'entrée et `modulepreload`, dédoublonnés, brut et gzip niveau 9) ; tableau Markdown
  dans `$GITHUB_STEP_SUMMARY` (sinon sortie standard) ; code 1 et message en français si Zod, la lecture de l'API
  du CV ou un texte des fixtures est dans un script, ou si `/` dépasse le budget. Budget en constante unique
  commentée : **152 306 o gzip** = 138 460 o mesurés sur la tête de la branche (390 965 o bruts, 8 scripts) + 10 %.
- `scripts/ci/tests/front-bundle-budget.test.sh` (lancé par `pnpm integrity:test` et le job `garde-fous`) : cas
  vert, Zod, lecture de l'API, fixtures, budget dépassé, entrée comptée une fois, résumé de job, entrées invalides.
- `ci.yml` : étape ajoutée dans `front-parcours`, `if: matrix.project == 'desktop-1280'`, après la génération.
  Aucun job ajouté : la surveillance « Arrêt au premier échec » est inchangée.
- Documentation : `docs/deploiement.md`, « Mesures et budget du JavaScript du front ».

## Décisions

- Une seule entrée de la matrice (même site généré, résumé unique), sur instruction de l'orchestrateur.
- Les textes de fixtures sont extraits par expression régulière des `cv.*.ts` (littéraux de 40 caractères et
  plus), sans importer le TypeScript ; au moins 10 textes exigés, sinon échec (témoin).

## Non fait / points ouverts

- **Mesure locale du site réel non lancée par moi** : les garde-fous refusent d'exécuter le script (et son test
  hors `pnpm integrity:test`) à un agent ; l'orchestrateur a demandé de ne pas le contourner. La mesure sur le
  vrai site se fait donc en CI. Seule référence : la sonde jetable (138 460 o gzip, génération sur fixtures).
- Source `api` non mesurée en local (pas de conteneur) ; le parcours `client-bundle.e2e.ts` couvre déjà ce site.
- Premier run CI : vérifier que le tableau du résumé donne bien 138 460 o pour `/` ; sinon, remesurer.
- Première version du test : 5 échecs révélés par `pnpm integrity:test` (expression régulière des
  `modulepreload` fausse, `set -e` sur un code de sortie attendu), corrigés dans le script et le test, tous
  deux créés dans ce lot.
- Conteneurs : aucun démarré.

## Vérifications

- `pnpm integrity:test` : vert (tous les `*.test.sh`).
