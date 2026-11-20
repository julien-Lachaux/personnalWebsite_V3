# Recette du lot F5a (chef de projet) : sections Profil, IA, Recommandations

Date : 20-21 novembre 2026. Branche `lot/F5a-sections` (778c02f), base `b3ca884`, worktree `lot-F5a-sections`, isolation `siteperso-v3-f5a` (5932-5935), arrêtée en fin de recette (`pnpm db:down`).

## Verdict : accepté avec réserves

Aucune réserve n'est bloquante ; la première concerne la fiabilité de `pnpm check` sous charge.

## Critères rejoués

| Critère | Commande | Résultat |
|---|---|---|
| `pnpm check` forme lot 14, sans cache | `TURBO_FORCE=true pnpm check` | **1re passe : code 1** ; **2e passe : code 0**, 11 tâches sur 11, 0 en cache, 5 min 19 s |
| Couverture 100 % | sortie de `test:coverage` (2e passe) | contrats 220 tests, web 811 tests (77 fichiers), api 1194 tests ; « All files 100 / 100 / 100 / 100 » pour les trois |
| Intégrité | `pnpm integrity develop` | code 0, « Intégrité des tests : OK » |
| Périmètre | `git diff --stat b3ca884...849c219` | 22 fichiers, tous dans `components/{profile,ai,recommendations}/`, `i18n/locales/{fr,en}/{profile,ai,recommendations}.json` et le compte rendu du dev ; rien d'ailleurs |
| Aucun test existant modifié | `git diff --diff-filter=MD` | seuls 6 JSON de libellés modifiés (clés ajoutées, aucune retirée) ; aucun test modifié ni supprimé, donc pas de `Justification-test` requise |
| Marqueurs `skip/only/todo/fails`, ignores v8/c8/istanbul | grep sur les trois dossiers | aucun |

**1re passe en échec.** `@siteperso/web#test:coverage` : 8 fichiers en échec (`base/*.spec.ts`, `composables/shell/*.spec.ts`), tous `HookTimeoutError: Hook timed out in 10000ms` dans `beforeAll` de `@nuxt/test-utils` (680 tests réussis, 131 non exécutés). Fichiers hors lot, charge machine à 31 (16 cœurs, autres worktrees F3c et F5b actifs, `TURBO_FORCE` qui lance lint, typecheck et deux suites de tests en parallèle). La 2e passe, à charge de 15-21, est verte sans changement de code. Je conclus à un test flaky sous charge, non imputable au lot, mais je le signale : le délai de 10 s des hooks Nuxt est trop juste quand `pnpm check` tourne en parallèle d'autres worktrees (journal : `scratchpad/recette-f5a-check.log` puis `recette-f5a-check2.log`). Je n'ai pas touché au délai (configuration protégée).

## Fond

- **Props conformes à `CvView`** : types importés de `data/cv-view.js` (`ProfileView`, `LinksView`, `AiView`, `RecommendationView`, `LinkView`), aucun import du contrat dans les composants. OK.
- **Test temporaire non commité** (clone jetable, fixtures `cv.fr` et `cv.en` passées par `mapProfile`, `mapLinks`, `mapRecommendations`, `mapAi`) :
  - `links.github` nul dans les fixtures : aucun « GitHub » rendu. OK.
  - Citations : `figure > blockquote` et `figcaption`, `lang="fr"` partout (les recommandations de la fixture `en` sont en `fr`, repli de langue : cohérent avec `RecommendationView.lang`). Le cas `en` est couvert par `RecommendationsSection.spec.ts:72`. OK.
  - Liens externes : les trois liens rendus portent `target="_blank"` et `rel="noopener noreferrer"`. OK.
  - Titres : Profil `h3, h3` ; IA `h3, h4, h4` ; Recommandations aucun ; aucun `h2` posé par les sections. OK.
- **Valeurs en dur** : aucune couleur ni durée (couleurs en variables `--*`) ; aucun `px` hors seuils de requêtes média. Tailles en `rem` écrites en dur pour les espacements (gap, padding, ex. `0.625rem`), et `font-size: 1.375rem` dans `AiSection.vue:114` (à lister, voir points ouverts). Le titre du profil utilise les tokens `--font-size-h1-*`.
- **Axe** : `axe.spec.ts` par section avec témoin (violation détectée), tous verts dans la couverture.
- **Captures `mobile-390_profil_sombre` et `mobile-390_recos_sombre`** : non comparées. Il aurait fallu une page de démonstration dans l'app (hors périmètre et hors de mon rôle) ; le dev rapporte sa propre comparaison en Chromium, que je n'ai pas rejouée. À refaire par la qa-front ou au lot d'intégration.

## Processus

- **Journal des garde-fous** (`.claude/hooks/audit.log`, ligne par ligne sans identifiant de worktree, donc attribution par horodatage et par rôle `dev-front`) : refus d'écritures opaques ou de scripts écrits dans la même commande (ex. `shots.mjs`, `python3`/`perl` en ligne, 22 h 20 à 22 h 27) ; chaque refus est suivi d'un autre moyen sans répétition identique visible. Aucune autorisation (`grant`) pour `dev-front`, aucune violation de fin de tâche pour ce rôle. Pas de tentative répétée de contournement relevée.
  Un refus pour moi : `HUSKY=0 pnpm install` dans le clone jetable (« désactiver husky est interdit »). Non contourné par la même voie ; j'ai relancé `pnpm install --frozen-lockfile --offline` sans l'option, qui a abouti.
- **Cycles édition-test** : les 5 commits portent des dates à la seconde près (23:33:03 à 23:33:09), rejoués en bloc ; la transcription n'était pas fournie, donc cycles non mesurables. Aucun fichier touché plus d'une fois dans `git log` hors le compte rendu (un seul commit chacun). Non évalué au-delà.
- **Retrait d'un test au hasard** (`shuf`, clone jetable) : `ProfileTitle.spec.ts`, « garde la pastille seule sur la seconde ligne quand le titre n'a qu'un mot ». `pnpm run test:coverage` du web : **code 0**, 810 tests, couverture restée à 100 %. **Test redondant pour la couverture** : la branche `v-if="lines[1]"` à faux est atteinte par un autre test. Ses assertions (absence de `.profile-title__accent`, pastille seule) restent propres à ce test, mais la preuve par suppression ne l'a pas détecté. Pas bloquant.
- **Tests de réserve OpenAPI** : non applicables, le lot est front uniquement (aucune route, aucune API modifiée).
- Clone supprimé, conteneurs arrêtés, arbre propre avant ce document.

## Points ouverts du dev (non bloquants, à arbitrer par le lead)

1. `h1` en double entre la coquille et `ProfileTitle` : proposition du dev, `h1` de la coquille masqué visuellement (option a). Je la juge cohérente avec les tests (`titleTag` par défaut `div`).
2. Token `--font-size-h3-tile: 1.375rem` à créer ; valeur en dur `AiSection.vue:114` en attendant.
3. Titre de l'IA en une seule couleur (le contrat donne une chaîne ; la maquette en a deux).
4. Padding haut 20 px au lieu de 28 sur les onglets IA et Recos (coquille).
5. Parcours e2e `profile`, `ai`, `recommendations` reportés à l'intégration (`lang` des citations sur `/en`, liens externes, absence du bouton GitHub).
6. Noms réels dans les fixtures de recommandations (hors périmètre, F4) ; accord des auteurs avant publication.

## Questions fermées pour l'orchestrateur

- Faut-il relever `hookTimeout` de la configuration Vitest du web (ou limiter le parallélisme de `pnpm check`), vu l'échec de la 1re passe sous charge ?
- Retient-on l'option (a) pour le doublon de `h1` ?
- Crée-t-on `--font-size-h3-tile` avant F6 ?
