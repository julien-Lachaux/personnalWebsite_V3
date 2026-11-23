# Lot F10, correcteur : corrections des constats triés des revues du front

Date : 23 novembre 2026. Branche `lot/F10-revues`. Source : `docs/revues/triage-front-2026-11-23.md`
(commit e37dbc4). Isolation `siteperso-v3-f10` (5962 à 5965). Journaux : scratchpad de session,
préfixe `f10-fix-`. Aucun push.

## Fait

| Finding | Commit | Ce qui change | Preuve (avant, après) |
|---|---|---|---|
| RA-1 | f95f045 | `AppShell.vue`, `ExperienceSection.vue` : sous 1024 px et 30 rem de haut (`@media (max-width: 1023px) and (max-height: 30rem)`, la hauteur suit la taille de texte), la coquille ne tient plus en `100dvh` : la page défile, en-tête, filtre et barre d'actions sont statiques, la navigation du bas est seule fixe (`position: sticky; bottom: 0`, `scroll-padding-bottom` sur `html`), la liste de l'XP prend la hauteur de son contenu. | Nouveau `test/short-height.e2e.ts` (320 × 256 et 320 × 200, texte 100 et 130 %, fr et en : page qui défile, en-tête et barre d'actions qui bougent, navigation immobile, liste XP visible sur au moins 60 px, aucun débordement horizontal sur l'XP). Avant : 16 échecs sur 16 (`f10-fix-ra1-avant.log` : navigation `reste fixe` en échec, hauteur visible de la liste 0 à 111 px sous le minimum). Après : 16 passent. Régression : shell, matrix, overflow, experience, defects-f8 à 390, 834 et 1280 : 333 passent. |
| RA-2 | 77dcd99 | `useActionBar.ts` : tant que le focus clavier (`:focus-visible`) est dans la zone qui défile, la barre ne se masque pas, et un `focusin` (écouteur sur `document`, retiré au nettoyage) la ramène quand le focus clavier y entre. `ActionBar.vue` inchangé. | Nouveaux `useActionBar-keyboard.spec.ts` (8 cas ; 3 échecs avant, 8 verts après) et `test/action-bar-keyboard.e2e.ts` (Tab atteint « Lancer l'entretien » puis « CV PDF », Profil et XP, 390 et 834, fr et en). Avant : 6 échecs sur 8 (`f10-fix-ra2-avant.log`, Profil à 834 passe car le contenu tient). Après : 8 passent. `useActionBar.spec.ts` et `ActionBar.spec.ts` inchangés et verts ; sections, shell, journeys à 390 et 834 : 82 passent. |
| RC-1 | d38a394 | `test/mosaic.e2e.ts` (autorisation 30a35cec) : le cas des captures se décide d'après `page.viewportSize().width` et la langue, jamais d'après la mesure ; la zone attendue est exigée (1280 : 1280 × 788 ; 1024 fr : 1024 × 712 ; 1024 en : 1024 × 683, défaut connu F5c, positions laissées au test « positions conformes à `computeLayout` »). Aucun marqueur de saut. | Avant (triage) : `1024 /en zone 1024x683 -> retour anticipé, aucune assertion`, vert en 667 ms. Après : `portable-1024`, `desktop-1280`, `grand-1440`, fr et en : 6 passent, le cas 1024 en dure 1,4 s comme les autres (`f10-fix-rc1-apres.log`). Efficacité : copie jetable (supprimée) avec zones attendues fausses (683 → 600, 788 → 700) : 3 échecs sur 4 (`f10-fix-rc1-mutant.log`), le quatrième (1024 fr, non modifié) passe comme prévu. |
| RA-3, RA-4 | 6a6fd71 | `ProfileTitle.vue` : `overflow-wrap: anywhere`, `min-width: 0`. `ActionBar.vue` : `flex-wrap: wrap` sur les boutons, contact `flex: 1 1 auto`, CV `overflow-wrap: anywhere`. | Nouveau `test/title-overflow.e2e.ts` (320 px à 100, 115, 130 % et espacement, fr et en ; 390 px espacement + 130 %, fr et en ; mesure des rectangles de texte contre le conteneur). Avant : 5 échecs sur 10 (dépassements 31, 73, 165 px, `f10-fix-ra34-avant.log`). Après : 10 passent. Régression : matrix, overflow, defects-f8, design-system, sections à 390, 834, 1280 : 168 passent. |
| RA-6 | a8b8dd8 | `TechChip.vue`, `TechOption.vue` : `opacity: 0.75` retirée du compteur (la règle `:hover` de `TechChip` reste unique, voir « Décisions »). | Nouveau `test/chip-counter-contrast.e2e.ts` (contraste calculé sur les couleurs rendues, quatre palettes, fr et en, puce active puis survolée, au moins 4,5:1). Avant : 4 échecs (clair 3,80:1, clair renforcé 3,39:1, `f10-fix-ra6-avant.log`). Après : 8 passent. Régression : experience et controls à 390 et 1280 : 154 passent ; unitaires `base` et `experience` : 285 passent. |
| RA-9 | a886e5c | `AccessibilityPanel.vue` : `.a11y-panel__link` en `inline-flex` avec `min-height: var(--touch-target)` sous 1024 px. | Nouveau `test/panel-link-target.e2e.ts` (390 et 834, fr et en). Avant : 4 échecs, hauteur 21 px. Après : 4 passent ; shell.e2e à 390 et 834 : 50 passent avec lui. |
| RC-6 | 035d740 | `app/domain/plural-rules.ts` (`frenchPlural` : zéro et un au singulier pour les messages à deux formes, sinon règle par défaut), branché par `i18n/i18n.config.ts` (`pluralRules.fr`). `experience.json` et l'anglais inchangés. | Nouveaux `plural-rules.spec.ts` et `TechOption-plural.spec.ts` (0, 1, 2 en fr et en). Avant : `TypeScript, 0 expériences` attendu `0 expérience` (1 échec sur 6, `f10-fix-rc6` dans la sortie du terminal). Après : 6 passent. Mutation de `plural-rules.ts` : 100,00 (8 tués, 0 survivant, `f10-fix-rc6-mutation.log`). |
| RC-10 | 9da6c71 | Commentaires de `EasterEggWindow.vue` (textes de l'i18n, non de `site-content.json`) et de `ContactButton.vue` (adresse invalide : la génération échoue avant). `test/sections.e2e.ts:172` non touché. | Prettier et lint verts ; aucune ligne de code modifiée. |

## Non fait

- **RA-5 (Popover, sortie honorable)** : la correction (fermeture sur `focusout` dont `relatedTarget` est
  hors de la racine, sans reprendre le focus) casse un test existant, `Popover.spec.ts` ligne 237 :
  « non modal : reste ouvert quand le focus sort, sans piège de focus ni voile ». Il fait `byId('other').focus()`
  et attend `panel().hasAttribute('hidden')` à `false` (ligne 250). Sortie, avec la correction appliquée :

  ```
  FAIL  |nuxt| app/components/base/Popover.spec.ts > Popover > non modal : reste ouvert quand le focus sort, sans piège de focus ni voile
  AssertionError: expected true to be false
   ❯ app/components/base/Popover.spec.ts:250:44
      250|     expect(panel().hasAttribute('hidden')).toBe(false);
  Tests  2 failed | 322 passed (324)   (l'autre échec est RA-6, voir « Décisions »)
  ```

  Le triage n'a pas établi ce test faux (il documente le comportement que RA-5 veut changer) et
  l'autorisation 30a35cec ne couvre que `mosaic.e2e.ts` : je me suis arrêté. Correction écartée, aucune ligne
  de `Popover.vue` commitée. Le correctif et son spec (6 cas, dont 1 en échec avant : se ferme hors racine ;
  reste ouvert dans la racine, sans cible, panneau fermé ; ne reprend pas le focus ; Échap intact) sont
  conservés dans le scratchpad : `f10-fix-Popover.diff` et `f10-fix-Popover-focusout.spec.ts.txt`.
  Décision attendue : autoriser la modification de ce test (renommer en « reste ouvert quand le focus passe
  dans la page sans sortir de la racine » et remplacer l'assertion par la fermeture) sous
  `Justification-test: RA-5`, ou garder le comportement non modal actuel.
- Sonde navigateur de RC-6 sur `/?tech=typescript,nodejs` : un script écrit puis lancé dans la même commande
  a été refusé par les garde-fous (« script écrit par la même commande », `f10-fix-rc6-probe.mjs`). Je n'ai
  pas reformulé ; la preuve est le test de composant, qui tourne dans l'application Nuxt de test avec la
  vraie configuration i18n.

## Décisions

- RA-1 : seuil de 30 rem (480 px à 100 %, 624 px à 130 %), choisi pour couvrir 320 × 256 et 320 × 200 sans
  toucher les captures verticales ; les téléphones en paysage (hauteur de l'ordre de 390 px) passent aussi
  en page qui défile, ce que 1.4.10 admet. Navigation en `sticky` plutôt qu'en `fixed` : aucune marge basse
  à calculer. À 130 %, les mêmes règles tiennent.
- RA-6 : l'opacité est retirée du compteur dans tous les états, pas seulement actif ou survolé. Une règle
  `:hover` de plus aurait cassé `TechChip-hover.spec.ts` (« a une seule règle de survol », test existant, non
  modifiable) ; le contraste ne baisse nulle part, le compteur inactif est un peu plus marqué que dans le
  handoff.
- RC-6 : la règle vit dans `app/domain/plural-rules.ts` (couverte, mutation 100 %) plutôt que dans le fichier
  de configuration, hors de `app/` ; `i18n/i18n.config.ts` ne fait que la brancher (nom de fichier lu par
  `@nuxtjs/i18n`). Le message de l'anglais garde la règle par défaut de vue-i18n.
- Tests : nouveaux fichiers seulement, sauf `mosaic.e2e.ts` (autorisé). Les parcours à fenêtre fixe posent
  leur taille par `test.use` : ils tournent aussi sous les projets de la configuration, sans effet de plus.

## Vérifications ciblées (fin de lot, `.env` du worktree, aucune base utilisée)

- `pnpm --filter @siteperso/web lint` et `typecheck` : verts (aussi à chaque commit par le hook pre-commit).
- `TEST_MAX_WORKERS=2 pnpm --filter @siteperso/web test:coverage` : 118 fichiers, 1121 tests, 100 %
  (instructions 1422/1422, branches 760/760, fonctions 458/458, lignes 1265/1265).
- Mutation des seuls fichiers de `app/domain` touchés : `stryker run --mutate app/domain/plural-rules.ts`,
  100,00 (aucun autre fichier de `app/domain` ni `app/data` modifié).
- Parcours finaux sur le site généré à la tête de la branche (`short-height`, `action-bar-keyboard`,
  `title-overflow`, `chip-counter-contrast`, `panel-link-target`, `mosaic`, projets mobile-390, tablette-834,
  portable-1024, desktop-1280, 3 workers) : 280 passent, 0 échec (`f10-fix-final-e2e.log`).
- `pnpm integrity origin/develop` : « Intégrité des tests : OK ».
- Conteneurs : `pnpm db:down` fait ; serveurs `sirv` des parcours arrêtés par Playwright. Pas de base de
  données utilisée par ce lot (front seul).

## Points ouverts

- RA-5 : décision de l'orchestrateur sur le test `Popover.spec.ts:237` (ci-dessus).
- Hors périmètre, non touchés : RC-2/RS-3, RC-3, RC-4, RA-7, RA-8, RA-10, Q8, RS-1, RS-5, RC-8, RC-5, RC-7,
  RC-9, RS-2, RS-4, RS-6.
- RA-1 : à 130 % et 320 px, le titre du Profil (RA-3) déborde sans la correction RA-3 ; l'ordre des commits
  RA-1 puis RA-3 est donc sans effet sur la recette, qui voit les deux.
