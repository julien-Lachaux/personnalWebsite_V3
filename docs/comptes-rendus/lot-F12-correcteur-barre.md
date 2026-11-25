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
