# Lot F12, correcteur, F12-ENTETE (D43)

| Finding | Commit | Ce qui change | Preuve |
| --- | --- | --- | --- |
| F12-ENTETE | 120a0c4 | `HeaderControls.vue` : langue, puis accessibilité, puis thème (toutes les barres). `LanguageSwitch.vue` : la langue courante prend la boîte du lien (40 px, 44 px sous 1024 px) et `var(--accent)`. | Avant : 2 tests échouent après le changement d'ordre (HeaderControls, TopBar) ; mis à jour. Après : 24 fichiers shell/layouts/error, 182 tests verts ; `test:coverage` 125 fichiers, 1141 tests, seuils 100 % ; lint et typecheck verts. |

## Contrastes (calcul depuis tokens.css)

`--accent` sur `--top` / `--bar` / `--bg` : clair 7,14 / 5,35 / 6,45 ; sombre 8,19 / 8,04 / 9,81 ;
sombre renforcé 11,86 / 9,85 / 13,75 ; clair renforcé 11,76 / 8,08 / blanc 11,76. Minimum 5,35:1 (> 4,5).
`tokens.spec.ts` couvre déjà `accent` sur `top`, `bar` et `bg` dans les quatre palettes.

## Tests

- Modifiés (autorisation F12-ENTETE) : `HeaderControls.spec.ts`, `TopBar.spec.ts` (ordre seulement).
- Ajouté : `LanguageSwitch-d43.spec.ts` (structure identique dans les deux langues, boîte 40/44 px, accent).
- `LanguageSwitch.spec.ts`, `-d19`, `MobileHeader`, `axe`, `annex`, `error` : verts sans modification. `shell.e2e.ts`
  et `smoke.e2e.ts` : relus, aucune assertion sur l'ordre ni la couleur, non modifiés.

## Non fait

- Parcours Playwright non lancés : le poste n'a pas `docker` (Podman, scripts de `lot/podman` absents de cette branche),
  `pnpm e2e:browsers:up` échoue (`docker: commande introuvable`). Pas de capture de référence touchée ni régénérée.
  Le `.env` d'isolation créé a été retiré, aucun conteneur démarré.
- Aucune capture visuelle de référence du handoff ne dépend de l'ordre (non vérifié par exécution).

## Décisions / points ouverts

- Séparateur fixe obtenu par boîtes identiques (pas de largeur en dur) ; la langue courante reste un `span`.
- Ma branche a été avancée en fast-forward sur `lot/F12-retours-installation` (d5e6ec9) avant de commencer.
- À rejouer en CI ou après le lot podman : `shell.e2e.ts` (cible 44 px, focus Shift+Tab/Tab du lien) et `smoke.e2e.ts`.
