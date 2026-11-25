# Lot F12, correcteur, F12-PROFIL (tailles de texte du Profil, D41)

Date : 25 nov. 2026. Base : `d5e6ec9` (le worktree partait de `develop` ; avancé en fast-forward sur le commit de D41).

## Fait

| Finding | Commit | Ce qui change | Preuve |
| --- | --- | --- | --- |
| F12-PROFIL | voir `git log` (un commit) | `ProfileSection.vue` : accroches, mission et intro passent de `--font-size-body-mobile` / `--font-size-lead-mobile` (< 1024 px) et `--font-size-lead` (bureau) à `--font-size-lead` (< 1024 px) et `--font-size-body-mobile` (bureau), comme `.ai__text`. `SituationCard.vue` : `.situation__now` et `.situation__value` (`--font-size-body`) suivent la même règle ; titres et termes (`--font-size-meta`) passent à `--font-size-small`, comme `.ai__label`. Nouveau test `text-sizes.spec.ts`. | Le test échoue avant (`.profile__mission: expected '--font-size-lead-mobile' to be '--font-size-lead'`, 3 échecs sur 3), passe après ; 31 tests du dossier `profile` verts. |

Correspondances retenues (AI : `.ai__text` = `--font-size-lead` sous 1024 px, `--font-size-body-mobile` dès 1024 px ; `.ai__label` = `--font-size-small`) :

| Texte du Profil | Avant (< 1024 px / bureau) | Après |
| --- | --- | --- |
| accroches `.profile__taglines` | body-mobile / body-mobile | lead / body-mobile |
| `.profile__mission`, `.profile__intro` | lead-mobile / lead | lead / body-mobile |
| `.situation__now`, `.situation__value` | body / body | lead / body-mobile |
| `.situation__title`, `.situation__term` | meta / meta | small / small |

Aucun test existant modifié : aucun ne vérifiait une taille (donc pas de `Justification-test`). Aucun token modifié.

## Écarts relevés, non modifiés (décision de Julien)

Référence IA : texte courant `--font-size-lead` (17 px) sous 1024 px, `--font-size-body-mobile` (16 px) dès 1024 px ; étiquette `--font-size-small` (14 px).

Recommandations : alignées (citation `.reco__quote` et nom `.reco__author` lead puis body-mobile, légende `.reco__caption` small). Aucun écart net.

Expérience (écarts modestes, 1 px sur le texte courant) :

| Fichier | Sélecteur | Token actuel | Token d'IA |
| --- | --- | --- | --- |
| `experience/CardIntro.vue` | `.card-intro__summary` | body-mobile (16 px) à toute largeur | lead sous 1024 px |
| `experience/ExperienceCard.vue` | `.experience-card__details li` | body-mobile à toute largeur | lead sous 1024 px |
| `experience/CardHeader.vue` | `.card-header__org` | body (15 px) | texte courant : lead / body-mobile |
| `experience/ResultGroups.vue`, `SuggestionList.vue` | lignes de résultat | body-mobile, body (15 px) | idem |
| `experience/TechOption.vue`, `AllTechs.vue`, `TechFilter.vue`, `FilterDrawer.vue`, `EasterEggWindow.vue` | méta / étiquettes | meta (13 px) | small (14 px) |
| `experience/CardHeader.vue` | `.card-header__title` | 1.25rem en dur (hors token) | pas d'équivalent |

## Non fait

- Liens sociaux : `LinkButton` taille `lg` lit `--font-size-body-mobile` (16 px, `base/button.css`, fichier partagé) ; la section IA n'a pas de bouton comparable, rien à aligner, inchangé.
- Titre du profil (`ProfileTitle`) : hors périmètre (grand titre, pas un équivalent IA).
- Parcours Playwright : non lancés (aucun test e2e ne dépend des tailles changées ; la réduction S est traitée par l'autre correcteur). Aucune capture de référence touchée.

## Décisions

- Les accroches (chapeau) prennent la taille du texte courant d'IA, faute de chapeau dans IA ; elles gardent graisse et couleur.
- Les écarts du Profil par rapport à IA : le Profil était déjà plus grand que IA au bureau (lead contre body-mobile) ; l'effet « trop petit » vient de la réduction S, supprimée en parallèle. L'alignement baisse donc d'1 px le texte courant du bureau.

## Points ouverts

- Vérifier visuellement après fusion avec la correction de la mosaïque (D41) que le Profil défile bien sans rogner l'encart.
