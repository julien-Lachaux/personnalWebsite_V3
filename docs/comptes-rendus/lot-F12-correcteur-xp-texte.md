# Lot F12, correcteur : F12-XPTEXTE (tailles de texte d'Expérience, D45)

Branche : worktree `worktree-agent-a90b6b2e78cc7da7e`, fusionnée depuis `lot/F12-retours-installation` (a541876).

## Fait

| Finding | Ce qui change | Preuve |
| --- | --- | --- |
| F12-XPTEXTE | Les textes d'Expérience prennent les tailles de la section IA (D45). | Nouveau `components/experience/text-sizes.spec.ts` : 4 tests en échec avant (`.card-intro__summary: expected '--font-size-body-mobile' to be '--font-size-lead'`, `.suggestions__none` idem, `.tech-option__count: '--font-size-meta'` au lieu de `--font-size-small`, titre en `1.25rem`), verts après. |

Tailles avant / après (jetons ; « < 1024 » puis « >= 1024 », comme `.ai__text`) :

| Élément | Avant | Après |
| --- | --- | --- |
| `.card-intro__summary` | body-mobile (16 px) partout | lead (17 px) puis body-mobile (16 px) |
| `.experience-card__details li` | body-mobile partout | lead puis body-mobile |
| `.result-groups__message` (aucun résultat) | body-mobile partout | lead puis body-mobile |
| `.suggestions__none` | body (15 px) partout | lead puis body-mobile |
| `.card-header__title` | `1.25rem` en dur (20 px) | `--font-size-h3-tile` (22 px) |
| `.tech-option__count` | meta (13 px) | small (14 px) |
| `.all-techs__title` | meta | small |
| `.tech-filter__label` | meta | small |
| `.filter-drawer__label` | meta | small |
| `.egg__terminal` (easter egg) | meta | small |

Inchangés, volontairement : `.card-header__org` (15 px, nom d'organisation en gras accentué, sous-titre du titre et non texte courant ; équivalent de la puce IA du bureau), `.card-header__period`, `.card-intro__meta`, `.card-intro__partial`, `.result-groups__title`, `.suggestions__count` (déjà `--font-size-small`), `.suggestions__item` et les champs de `ChipInput` (contrôles de saisie à 16 px, déjà au niveau du texte courant du bureau), tokens, Profil, IA, CvButton.

## Vérifications (worktree, `.env` racine ports 5870 à 5873, Podman)

- `pnpm --filter @siteperso/web lint` : 0 avertissement.
- `typecheck` : vert (après correction d'un accès d'index dans le nouveau test).
- `test:coverage` : 127 fichiers, 1143 tests verts, seuils 100 % respectés.
- Playwright complet via `test:e2e` (génération sur fixtures, sept projets mobile-390, tablet-834, 1024, desktop-1280, 1440, 1920, ultra-3440, fr et en, clair et sombre, axe) : 2156 tests passés, 0 échec, 0 flaky. Les parcours de débordement existants (`overflow.e2e.ts`, `title-overflow.e2e.ts`, `experience.e2e.ts`: puces, tiroir de filtres, recherche, easter egg, barre du haut) passent sans modification.
- `pnpm integrity develop` : voir ci-dessous.

## Non fait / décisions

- Aucun test existant modifié : aucun n'a cassé, les autorisations nominatives n'ont pas servi.
- Décision : `.card-header__org` laissé à 15 px (voir ci-dessus).
- Conteneurs arrêtés en fin de tâche.
