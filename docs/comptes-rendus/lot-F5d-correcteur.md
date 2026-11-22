# Lot F5d : compte rendu du correcteur (F5D-2)

| Finding | Commit | Ce qui change | Preuve |
| ------- | ------ | ------------- | ------ |
| F5D-2 | voir `git log` (sujet `fix(web): F5D-2 …`) | `shell.e2e.ts`, `experience.e2e.ts` : `axe()` attend d'abord `waitForSettledAnimations` (`page.waitForFunction` : plus aucune animation `running` de durée finie dans `document.getAnimations()`). `design-system.e2e.ts` : même attente avant l'axe qui suit `setRoot` (transitions de couleur au changement de thème). `controls.e2e.ts` : inchangé. | Avant : sonde (fondu ralenti 20 fois après le clic sur l'onglet IA, thème clair, axe `color-contrast`) = 6 violations sans attente, 0 avec. Après : shell 420/420 (`mobile-390` + `tablette-834`, `--repeat-each=10`, 2 workers) ; experience + design-system + controls 198/198 (`mobile-390`, `desktop-1280`) ; lint et typecheck verts. |

## Avant / après par fichier

- `shell.e2e.ts` : avant, `axe()` s'exécutait juste après `toHaveCount(1)`, donc pendant le fondu
  `slide-in-*` (opacité < 0,9, contraste mélangé au fond). Après, attente déterministe de la fin des
  animations, aucun délai fixe, aucune règle désactivée. Tous les appelants (l. 121, 133, 200) en profitent.
- `experience.e2e.ts` : mêmes appels `axe` (repos, panneau déplié, suggestions, accordéon, fenêtre) :
  panneaux et accordéons ont des transitions ; même attente dans sa fonction `axe()`.
- `design-system.e2e.ts` : axe après changement de thème sur `<html>` ; attente ajoutée en ligne (une seule occurrence).
- `controls.e2e.ts` : revu, rien à changer : les puces sont montées après `setRoot`, leur
  `border-color` est lue sans transition en cours.

Les animations infinies (`scroll-hint-nudge` de `ScrollHint.vue`) sont exclues de l'attente
(`endTime === Infinity`), sans quoi elle ne finirait jamais. Aucune zone de `test/support/` n'existe :
l'attente est dupliquée par fichier (shell, experience) et en ligne (design-system).

## Preuve de l'échec avant

Sonde `…/scratchpad/f5d2-probe.mjs` (journal `f5d2-avant.log`) : fondu ralenti (`playbackRate = 0.05`)
juste après le clic, puis axe `color-contrast` :

```
SANS attente violations: 6
AVEC attente violations: 0
```

Les parcours eux-mêmes ne montrent pas l'échec en local (non reproductible sans gel, cf. triage) :
la preuve de la cause est la sonde, la preuve d'absence d'échec est la répétition ×10.

## F5D-1

Non traité ici et non démontré : F5D-1 (panneau « toutes les technos » du parcours XP) passe par
`experience.e2e.ts`, mais seuls les appels `axe` y reçoivent l'attente. Si F5D-1 est une assertion de
position ou de style, elle n'est pas couverte ; son triage doit trancher.

## Non fait, points ouverts

- `pnpm integrity develop` : voir ci-dessous (lancé après le commit).
- Pas de `pnpm check` ni mutation (D26).
