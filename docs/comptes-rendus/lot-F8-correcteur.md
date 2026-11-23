# Lot F8 : corrections BUG-F1 et BUG-F3 (correcteur)

Date : 23 novembre 2026. Branche `lot/F8-qa`. Sans triage (décision de Julien). Autorisation a7e258e5.

| Finding | Commit | Ce qui change | Preuve |
| ------- | ------ | ------------- | ------ |
| BUG-F2 | « retire le cas BUG-F2 » | Cas retiré de `defects-f8.e2e.ts` : l'ellipse de l'en-tête mobile est voulue (SPEC § 3.1), à revoir en revue finale. | `Justification-test` au commit |
| BUG-F1 | « corrige les défauts à 130 % » | `RecommendationsSection.vue` : `.recos__source.base-button` reprend `white-space: normal`, `max-width: 100%`, `height: auto`, `text-align: start`. | Avant : 13 échecs sur 28 (tuile 1024 à 3440, onglet 390, fr et en). Après : 28 réussis. |
| BUG-F3 | idem | `ActionBar.vue` : classe `action-bar__cv` sur le bouton CV, `.action-bar__cv.base-button { flex: 0 1 auto; min-width: 0; white-space: normal }`. | Avant : échec à 390 en. Après : réussi. |

## Causes

- Les deux défauts viennent de `white-space: nowrap` de `base/button.css`, propre à tous les boutons et liens
  en forme de bouton. À 130 % un libellé long ne peut plus passer à la ligne : le lien LinkedIn dépasse sa
  tuile (rognée par `overflow`), le bouton « CV PDF (in French) » élargit la rangée à 494 px pour 390.
- Correction locale à chaque emploi (pas de changement de l'élément de base, qui sert partout). Sélecteur
  doublé (`.x.base-button`) pour l'emporter sur la feuille de l'élément de base quel que soit l'ordre
  de chargement. Aucune valeur en dur, la cible de 44 px (`min-height`) et le nom accessible (texte visible
  inclus) sont inchangés.

## Tests

- Marqueurs `test.fail` de BUG-F1 et BUG-F3 retirés (`Justification-test: BUG-F1-F3 défauts corrigés,
  marqueurs retirés`). Échec constaté sans marqueur et sans correction (13 échecs), puis 28 réussis avec.
- Journaux : `f8-fix-before.log`, `f8-fix-after.log` du scratchpad.

## Vérifications ciblées

lint, typecheck et `pnpm --filter @siteperso/web test:coverage` verts (100 %). Playwright `defects-f8` sur
les 7 écrans ; `overflow`, `matrix`, `sections`, `shell` sur 390, 834 et 1280 : 153 réussis (voir aussi le
rapport de l'orchestrateur).

## Points ouverts

- BUG-F2 reste à revoir en revue finale.
