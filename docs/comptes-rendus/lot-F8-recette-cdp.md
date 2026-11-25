# Lot F8 : recette (chef de projet)

Date : 23 novembre 2026. PR #15, branche `lot/F8-qa`, tête e9a78a0.

## Preuves

- CI run 45167681567 (`pull_request`, tête e9a78a0) : 18 jobs verts, dont les 7 parcours Playwright + axe
  (390, 834, 1024, 1280, 1440, 1920, 3440), couverture 100 %, mutation (API, contrats, front), pile locale,
  Garde-fous. Revue PR : success, `VERDICT: OK`.
- Chaque job de taille : 223 parcours réussis (390 : 2,3 min de tests ; 834 : 3,4 ; 1280 : 5,0). Les journaux
  citent `journeys`, `matrix`, `overflow` et `defects-f8`. Durée de job : 3 min 25 (390) à 6 min 28 (3440, le
  plus long). Durée ajoutée par la matrice : non chiffrable, aucun run de référence avec jobs de parcours
  sur develop (le dernier run develop n'en comporte pas).
- `pnpm integrity origin/develop` : OK.
- Périmètre : 4 nouveaux fichiers de test, `RecommendationsSection.vue`, `ActionBar.vue`, docs. Aucun test
  existant modifié (seul `defects-f8.e2e.ts`, créé dans le lot). Le diff touche aussi
  `lot-F6b-recette-cdp.md` (+13 lignes de docs, hors périmètre annoncé mais sans risque).
- Corrections : sélecteurs locaux (`.recos__source.base-button`, `.action-bar__cv.base-button`) ; l'élément de
  base n'est pas modifié, `min-height` (44 px) inchangé, libellé visible inchangé donc nom accessible conservé.
- Aucun `test.fail`, `skip`, `only`, `fixme`, `slow` dans `apps/web/test` (seules occurrences : « skip-link »).
- Audit : autorisation 0e57ddb5 (qa-front, fails) : 3 éditions, toutes sur `defects-f8.e2e.ts` ; a7e258e5
  (correcteur, tests) : 3 éditions, toutes sur `defects-f8.e2e.ts`.
- Parcours : 4 cas `journeys` (filtre partagé et changement de langue, tuiles, onglets, réglages), 1 cas
  `matrix` paramétré, 1 `overflow` par langue ; 55 assertions au total. Pas de test sans assertion relevé.
  Je n'ai pas comparé ligne à ligne avec l'existant (revue de code et CI verte).

## Non fait

- Pas de retrait de test au hasard, ni tests de réserve OpenAPI, ni cycles édition-test : hors consigne
  (CI = seule vérification complète, lot front sans route d'API nouvelle).
- Les deux fichiers non suivis (`ai-placeholder.e2e.ts`, `test/support/`) laissés intacts. Stack Docker du
  worktree : aucun conteneur démarré par moi, rien à arrêter.

## Points ouverts

- BUG-F2 (ellipse de l'en-tête mobile) écarté par D29, à revoir en revue finale.
- La durée de la matrice dans la CI n'a pas de référence : mesurer au prochain run sur develop.

## Verdict

Accepté.
