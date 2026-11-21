# Lot F5c-OBS : correcteur (21 novembre 2026)

Autorisation 2441f410. Règle D23 (tests obsolètes par décision), D26 (vérifications ciblées).

| Élément | Avant | Après | Pourquoi |
|---|---|---|---|
| Patch `lot-F5c-bascule.patch` | HomePage provisoire | appliqué tel quel | bascule des 4 sections |
| `HomePage.spec.ts`, test fr | `li` d'accroches, « 8 expériences », « 3 recommandations », `p` de l'IA. Échec : `expected [] to deeply equal [ …(2) ]` | un seul `h1`, accroches `.profile__tagline`, section XP (`role=search` « Filtrer les expériences », « filtrer par techno », OpenClassrooms), recos (« Voir sur LinkedIn »), titre IA de la fixture | le contenu provisoire n'existe plus ; langue, h1, contenu de fixture conservés |
| `HomePage.spec.ts`, test en | « 8 experiences ». Échec : `expected 'filter by tech' to be '8 experiences'` | un seul `h1`, accroches EN, filtre « Filter experiences » / « filter by tech », titre IA EN | idem |
| `design-system.e2e.ts` « espacement du texte » | cible `main p` premier (accroche, `letter-spacing: -0.01em`). Échec : `- "normal" + "-0.16px"` aux 7 tailles | cible `main .profile__intro` (texte courant sans espacement de maquette) ; mêmes assertions (normal ; [1,5 ; 0,12 ; 0,16]) | l'exigence WCAG 1.4.12 est inchangée, seule la cible l'était à tort |

## Non fait : fixtures OpenClassrooms `location: null`
Modifiées puis rétablies. Les fixtures concordent avec `db/seeds/0004_experiences.sql` (location null, FR et EN),
mais `apps/web/app/data/map-cv.spec.ts` (non autorisé) l'exige : avec `location: null`,
`FAIL map-cv.spec.ts > mapExperiences > le contrat none n’affiche rien ; un mode de travail seul reste` :
`expected 'WM[remote]' to be 'À distance, WM[remote]'` (l. 196). Il faut une autorisation sur `map-cv.spec.ts` (attendu
`'WM[remote]'`) pour livrer les deux ensemble. `cv-fixtures.spec.ts` et `HomePage.spec.ts` restent verts avec la
fixture inchangée. Mutation `app/data/` : non lancée (fixtures non modifiées dans le commit).

## Avis sur la ligne ajoutée à `experience.e2e.ts`
L'attente de `getAnimations().finished` précède seulement la mesure de départ ; l'égalité stricte `toEqual(before)` après
défilement est inchangée : assertion non affaiblie. Réserve : `getAnimations()` sans `{subtree: true}` ne couvre que les
animations de la section elle-même ; ça suffit ici (parcours vert aux 7 tailles), mais une animation posée sur un
ancêtre ne serait pas attendue.

## Vérifications
lint 0, typecheck 0, `test:coverage` 994 tests, 100 % ; Playwright `experience`, `sections`, `shell`, `design-system`,
`smoke` : 896/896 aux 7 tailles ; `pnpm integrity develop` : voir commit.
