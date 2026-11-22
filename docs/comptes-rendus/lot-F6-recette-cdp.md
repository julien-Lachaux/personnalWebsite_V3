# Lot F6 : recette du chef de projet (PR n° 6)

Date : 21 novembre 2026. Tête examinée : `503222e` (develop `9f66ac8` intégré). Mode : la CI de la PR est
l'unique vérification complète (aucun `pnpm check` ni mutation locale).

## Verdict : accepté avec réserves

Le lot est conforme sur le fond et sur le processus. Réserve : le job « Front » de la CI est rouge, pour
quatre tests hors périmètre du lot et déjà rouges sur `develop` (voir plus bas). La décision de fusion
revient à l'orchestrateur.

## CI et revue (lecture `gh`)

- Run **CI** `pull_request` **44935103714** : échec du seul job « Front » ; tous les autres jobs verts
  (e2e API et couverture, garde-fous, analyse statique, qualité, image Docker, pile locale, mutation
  contrats, front et API).
- Job Front : lint, typecheck, `test:coverage` verts ; Playwright : **1186 passés, 4 échecs**, tous
  `shell.e2e.ts:115` « axe WCAG 2.2 AA, palette clair, chaque section » (mobile-390 et tablette-834, fr et en) :
  `color-contrast` 4,38 sur `.base-button--tone-linkedin` (recommandations, `#246faf` sur `#e6ebe5`). Aucun
  échec de `mosaic.e2e.ts` (1024 à 3440), de `sections.e2e.ts` ni de `experience.e2e.ts`.
- **Même défaut sur `develop`** : run CI 44935045976 (fusion de la PR n° 4, `9f66ac8`), même job, mêmes tests
  `shell.e2e.ts:115` en échec (mobile-390 et tablette-834, contraste 4,08 et 4,38). Le lot ne touche ni
  `button.css`, ni `components/recommendations/`, ni la navigation par onglets (< 1024 px) : défaut antérieur.
  À traiter hors lot (correctif de couleur du bouton LinkedIn en thème clair, ou lot F7).
- Run **Revue PR** **44935103789** : succès ; commentaire du 21/11 18:24 : **`VERDICT: OK`**. Constats
  tous non bloquants : chemin local avec le nom d'utilisateur Unix dans `lot-F6-lead.md` l. 35 ; test des
  « cas des captures » qui sort par `return` si la zone ne mesure pas 788/712 px (peut devenir vide sans
  alerte) ; `passThroughEnv`/`inputs` de `turbo.json` pour `TEST_MAX_WORKERS` (point ouvert 3 du lead) ;
  `lot-F6-mosaic-e2e.patch` déjà appliqué, supprimable.
- (Les premiers runs sur `15:56`, 44921823079 annulé et 44921823099 en échec, sont antérieurs à la tête examinée.)

## Contrôles ciblés

- `pnpm integrity develop` : « Intégrité des tests : OK ».
- Périmètre : `git diff --name-only develop...HEAD` ne contient rien dans `apps/api`, `db`,
  `packages/contracts` (14 fichiers : coquille du front, tests, `vitest.config.ts`, `CLAUDE.md`,
  `.env.example`, comptes rendus).
- `vitest.config.ts` : ajout seul de `TEST_MAX_WORKERS` (validation par expression régulière, valeur
  invalide : erreur, ignorée sous Stryker, aucun seuil, sélection ni délai modifié) ; commit
  `Justification-test: F6`. Autorisation b34bc53d, usage : cinq `Edit` sur ce seul chemin (audit.log).
- `sections.e2e.ts` : seule la branche bureau de « marge haute » change : `padding-top` 12 px de `<main>`
  remplacé par l'écart de 12 px entre le haut de la zone et la tuile Profil (`toBe(12)`). Équivalent
  en intention, pas affaibli ; `Justification-test: F6-TESTS` (D23). Autorisation 2933b4f8 : usages sur
  `f6-captures.e2e.ts` (créé puis supprimé, jamais commité, 0 occurrence dans le log git du lot),
  `mosaic.e2e.ts` et `sections.e2e.ts` uniquement, aucun autre chemin.
- `mosaic.e2e.ts` (nouveau, patch du lead appliqué) : lu sur les cas des captures ; aucun marqueur de saut.
- Recalcul à la main du cas 1280 × 844 (zone 1280 × 788) : largeur utile 1280 − 24 = 1256 ; Profil 420,
  colonne droite 380, XP = 1256 − 420 − 380 − 24 = 432 à x = 12 + 420 + 12 = 444 ; IA et Recos à x = 888,
  hauteur (764 − 12) / 2 = 376 (y = 12 et 400). Identique aux valeurs attendues du parcours, qui passe en CI.
- Fond lu dans le compte rendu du lead et les parcours passés en CI : agrandir/réduire au clavier avec
  focus gardé, tuiles sorties `inert` + `aria-hidden`, animation 550 ms et mouvement réduit, Profil réduit
  par S sans défilement en mosaïque et défilant en colonne latérale, tuile XP sans défilement propre.
  Preuve : parcours `mosaic.e2e.ts` vert aux tailles 1024 à 3440 (fr et en), couverture 100 % verte.
  Je n'ai pas rejoué ces parcours en local (D26 : la CI fait foi).

## Réserves et points ouverts

1. Job Front rouge par un défaut antérieur (contraste du bouton LinkedIn en thème clair, < 1024 px) : à
   corriger avant ou après la fusion, décision de l'orchestrateur.
2. Chemin avec nom d'utilisateur dans `lot-F6-lead.md` l. 35 (constat de la revue).
3. Test « cas des captures » à rendre non muet (assertion sur la hauteur de zone au lieu d'un `return`).
4. `turbo.json` : `passThroughEnv` pour `@siteperso/web#test` (hors autorisation du lot).
5. Points du lead non traités : tuile IA vide sans section IA ; Profil à S = 0,6 qui déborde (blanc) ;
   bref saut grille simple puis mosaïque à l'hydratation.
6. `lot-F6-mosaic-e2e.patch` à supprimer ?
