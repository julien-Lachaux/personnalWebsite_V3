# Lot F8c : correction F8C-1 (correcteur)

Date : 23 novembre 2026. Branche `lot/F8c-instable`. Autorisation 59a99964 sur `apps/web/test/experience.e2e.ts`.

| Finding | Commit | Ce qui change | Preuve |
| --- | --- | --- | --- |
| F8C-1 | voir `git log` (sujet `fix(web): ... F8C-1`) | Test « suggestions et autres expériences » : après `fill('')`, attente de `filter-drawer--open` sur le panneau avant de cliquer « Voir les N autres » ; après le clic, attente de `aria-expanded="true"` sur le bouton devenu « Masquer les autres » (le nom change à l'ouverture). Aucune assertion retirée. | Avant : échec intermittent en CI (clic avant la fin de la mise en page, trace du triage). Après : `--repeat-each=20` sur ultra-3440 et desktop-1280, 160/160 verts chacun ; passe complète de `experience.e2e.ts` sur mobile-390 et desktop-1280 : 136 verts. |

## Autres occurrences

`grep -n "fill('')"` : une seule occurrence (l. 678), celle corrigée. Aucun autre test touché : les autres clics sur « Voir les N autres » (l. 368, 598) suivent un état stable (page chargée, ou cible mesurée après `field.click()` sans `fill('')` qui change la mise en page).

## Non fait / points ouverts

Aucun. Remarque : l'attente porte sur l'état final du panneau, pas sur un délai.
