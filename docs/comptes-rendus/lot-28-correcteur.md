# Lot 28, correcteur

## Fait

| Finding | Commit | Ce qui change | Preuve |
| ------- | ------ | ------------- | ------ |
| L28-01 | `test(web): attendre le mode de la coquille avant de lire la coche des puces` | `apps/web/test/chip-pressed-mark.e2e.ts`, test « 1280 px, coche des puces d'une carte » : ajout après `page.goto('/')` de `await expect(page.locator('.app-shell[data-mode]')).toHaveCount(1);`, l'attente déjà en usage dans les autres parcours. Aucune assertion, aucun délai, aucun essai ajouté. | 150 répétitions sur mobile-390, tablette-834 et fullhd-1920 (`--workers=2`) : 450 passés, 0 échec (5,5 min). Fichier entier une fois sur les trois projets : 27 passés. Lint, typecheck et prettier verts. |

Justification-test : L28-01, test faux établi par le triage (puce lue avant la bascule de la coquille en mosaïque), autorisation « tests » limitée à ce fichier.

## Non fait

Rien. Le code de production n'est pas touché (cause dans le test, selon le triage).

## Décisions

- Site régénéré avant les mesures (`contracts build`, `generate:fixtures`).
- Un premier commit de `lot-28-triage.md` a échoué au pre-commit (charge machine, le job turbo a échoué) ; les deux commits ont été refaits séparément.

## Points ouverts

- La CI de la pull request reste l'unique vérification complète.
