# Recette du lot F5d (correction F5D-2), chef de projet, 21 nov. 2026

Branche `lot/F5d-focus-xp`, tête 2ead632, PR #8.

## Verdict : accepté sous réserve d'une CI verte de la PR

## CI non lue
Les runs 44940030886 (CI, pull_request), 44940030944 (Revue PR) et 44940023587 (CI, push) ont échoué en
4 s : 0 étape, aucun journal (`log not found`). Le run `lot/22-un-seul-run` du même soir (44938175039)
échoue de la même façon. L'échec n'a donc rien à voir avec le code (limite du compte GitHub Actions,
d'après l'orchestrateur). Le job Front et la ligne `VERDICT:` n'ont pas pu être lus. Il faut les relancer
et obtenir une CI verte et `VERDICT: OK` avant la fusion.

## Contrôles rejoués
- `pnpm integrity develop` : OK (code 0).
- `git diff --stat develop...HEAD` : 3 parcours (`shell`, `experience`, `design-system`.e2e.ts, +46 lignes,
  aucune suppression) et 2 documents. `controls.e2e.ts`, autorisé, n'est pas modifié.
- `Justification-test: F5D-2 axe mesuré pendant le fondu d'onglet` présente sur le commit 2ead632.
- Autorisation 56e604c7 (`audit.log`) : 1 octroi et 3 usages, uniquement sur `shell`, `experience`,
  `design-system`.e2e.ts, ticket F5D-2.
- Pas un affaiblissement : l'attente est `page.waitForFunction` sur `document.getAnimations()` (condition,
  pas un délai fixe) ; aucune règle axe désactivée ; les assertions `violations` vide et `color-contrast`
  présent dans `passes` sont inchangées.
- Exclusion des animations infinies (`endTime === Infinity`) : une seule existe dans `apps/web/app`,
  `scroll-hint-nudge` (`ScrollHint.vue:60`), sur la flèche du bouton d'indice de défilement. Elle ne
  fait que `transform: translateY` : elle ne modifie aucune couleur ni opacité, et ne peut pas fausser
  le contraste du contenu mesuré. Elle ne masque donc rien.
- Contrôle ciblé : `playwright test test/shell.e2e.ts --project=mobile-390 --repeat-each=5 --workers=2` :
  105 réussis, 0 échec (2,3 min). Journal : scratchpad `recette-f5d-shell.log`.

## Points ouverts
- Le fragment d'attente est dupliqué dans trois fichiers (deux fonctions identiques et un bloc en ligne) :
  une factorisation dans `test/support` serait propre, hors périmètre de ce lot.
- Relancer la CI de la PR #8 après rétablissement des minutes, lire le job Front et la ligne `VERDICT:`.
