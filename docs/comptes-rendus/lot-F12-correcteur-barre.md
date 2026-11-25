# Lot F12, correcteur : F12-BARRE (barre du haut sur deux lignes à 1024 px en anglais)

Date : 25 nov. 2026.

## Mise en place

L'avance en fast-forward sur `lot/F12-retours-installation` était impossible : le worktree était sur
`80b756b` (develop, avec le lot podman) et la branche du lot sur `6f8e97b` + ses commits, sans
`lot/podman`. Les deux ont divergé. `git reset --hard` a été refusé par les garde-fous (non
reformulé) ; j'ai fait `git merge lot/F12-retours-installation` (commit de fusion `1d75134`), qui
donne l'état du lot plus podman (le `docker-compose.yml` porte déjà `oom_score_adj: 500`, aucune
surcharge nécessaire). Ce commit de fusion est à écarter si l'orchestrateur ne veut que les commits
de correction (cherry-pick du commit F12-BARRE).

## Résultat sur develop (80b756b)

Oui, la barre passait déjà sur deux lignes à 1024 px en anglais sur develop, avant D43. Preuve :
fichiers `HeaderControls.vue` et `LanguageSwitch.vue` de `80b756b` restaurés sur le code du lot, site
généré sur fixtures, nouveau test à 1024 : `Expected: 56, Received: 85` (hauteur de `/en`). D43 a
donc seulement aggravé un défaut existant (environ 20 px).

## Cause

À 1024 px, la zone utile est de 984 px. En français : 24 + marque 127 + 16 + nav 343 + 16 + actions
278 + 16 + contrôles 172 + 16 = 1008. En anglais, les actions passent à 368 px (« Start the
interview » 171, « CV PDF (in French) » 189, libellé de repli D22) : 1098 px, soit 74 px de trop. Le
conteneur est en `flex-wrap` et la nav aussi : l'onglet « AI » se replie, d'où 85 px.

## Correction (`TopBar.vue`, tokens locaux)

Trois propriétés personnalisées de la barre (`--top-bar-gap` 1rem, `--top-bar-tab-padding` 0.875rem,
`--top-bar-inset-start` 1.5rem, valeurs inchangées au-delà de 1280 px) resserrées de 1024 à 1279 px :
intervalles entre blocs 0.5rem (24 px gagnés), marges internes des onglets 0.5rem (48 px), marge
gauche 1rem (8 px) : environ 80 px pour 74 manquants. Rien n'est rogné ni masqué, cibles à 40 px de
haut et au moins 24 px de large (D17), séparateur fixe, langue courante en accent, ordre langue puis
accessibilité puis thème : composants D43 intouchés.

Choix : la plus sobre, aucun texte raccourci ni élément déplacé. Limite : la marge est d'environ 6 px à
1024 en anglais sans CV anglais ; un texte agrandi (115 %, 130 %) fait déjà grandir la barre comme
documenté dans le composant. Si Julien préfère de l'air, l'option de design serait de raccourcir le
libellé de repli du CV (« CV PDF (FR) ») ou de ne plus l'étendre à la barre du haut : décision de
design, non prise.

## Test ajouté

`apps/web/test/top-bar-height.e2e.ts` (nouveau) : à 1024 et 1280 px, hauteur de `.top-bar` égale entre
`/` et `/en`, ordonnée identique des cinq onglets, pas de débordement horizontal. Avant correction :
échec à 1024 (56 contre 85) ; après : vert à 1024 et 1280. Les autres projets retournent sans rien
vérifier (même usage que `language-switch-d43.e2e.ts`).

## Vérifications ciblées

| Vérification                                                            | Résultat                  |
| ----------------------------------------------------------------------- | ------------------------- |
| `pnpm --filter @siteperso/web lint`                                     | vert, zéro avertissement  |
| `pnpm --filter @siteperso/web typecheck`                                | vert                      |
| `pnpm --filter @siteperso/web test:coverage`                            | vert, 100 %               |
| Parcours `language-switch-d43`, `shell`, `top-bar-height` (1024, 1280, 390) | 75 réussis                |
| `pnpm integrity develop` | OK |

Aucun test existant modifié.

## Non fait, décisions, points ouverts

- Rien de non fait. Pas de mutation (aucun fichier de `domain/` ou `data/` touché).
- Point ouvert : marge de 6 px à 1024 px en anglais, voir plus haut.

## Suite : test `mosaic.e2e.ts` qui figeait le défaut (autorisation nominative F12-BARRE)

La CI (portable-1024) échouait sur « cas des captures recalculés » en `/en` : zone attendue 683 px
(barre sur deux lignes, « défaut connu F5c »), reçue 712 px. Le test était faux depuis la correction :
il encodait le défaut. Modifié : zone de 1024 à 712 px dans les deux langues, commentaire mis à jour, et
`return` anticipé de l'anglais à 1024 retiré (les positions du cas 1024 français valent aussi en
anglais). Avant : échec `683` attendu contre `712` reçu (rapporté par la CI). Après : `mosaic`,
`top-bar-height`, `language-switch-d43` sur portable-1024, desktop-1280 et mobile-390 : 90 réussis ;
`pnpm integrity develop` : OK ; conteneurs arrêtés. Commit avec `Justification-test: F12-BARRE`.
Le correctif de production est sur la branche du lot en `54ef8df` (cherry-pick de `9b6c869`).

## Suite 2 : preuve du défilement du Profil (revue de la PR 20)

`mosaic.e2e.ts`, test « Profil … défile quand il dépasse (D41) » : ajout de `scrollHeight > clientHeight`
sur le corps du Profil en colonne latérale (XP agrandie), puis `scrollTo` et `scrollTop > 0`. Premier
essai sans condition : 2 échecs, seulement à ultra-3440 (1440 px de haut, le Profil tient et ne dépasse
pas). À cette hauteur le test affirme donc l'absence de dépassement ; ailleurs il exige le dépassement
et le défilement. Résultat : `mosaic` sur portable-1024, desktop-1280, grand-1440 et ultra-3440 : 104
réussis ; lint vert ; `pnpm integrity develop` : OK ; conteneurs arrêtés. Commit avec
`Justification-test: F12-BARRE` (ajout d'assertions dans un test existant).

## Suite 3 : seuil de hauteur corrigé (1920 × 1080)

Le seuil `height >= 1440` était faux : à 1920 × 1080 le Profil ne dépasse pas non plus (CI en échec, fr
et en). Je n'avais vérifié que quatre projets ; cette fois les sept. Seuil à `height >= 1080` :
absence de dépassement à 1920 × 1080 et 3440 × 1440, dépassement et défilement jusqu'à 900 de haut
(1024 × 768, 1280 × 844, 1440 × 900) ; 390 et 834 retournent avant (pas de colonne latérale).
Résultat de `mosaic.e2e.ts` : 26 réussis sur chacun des sept projets, 0 échec ; `pnpm integrity
develop` : OK ; conteneurs arrêtés. `Justification-test: F12-BARRE` au commit.
