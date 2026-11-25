# Lot F5c : recette du chef de projet (21 novembre 2026)

Branche `lot/F5c-integration` (6346418, develop intégré). Journaux : scratchpad `recette-f5c-*.log`.

## Preuves rejouées
| Critère | Commande | Résultat |
|---|---|---|
| Vérification complète (D26) | `docker compose down -v` puis `TURBO_FORCE=true pnpm check` | code 0 ; API 1194 tests, web 994 tests, 117 + 96 fichiers ; Playwright 1022 passés (7 tailles) |
| Couverture 100 % | `test:coverage` dans le check | web : 100 % instructions, branches, fonctions, lignes (1162/660/380/1038) |
| Mutation front | `pnpm --filter @siteperso/web test:mutation` | code 0, score 100,00 (seuil 100) ; 1 mutant en timeout (`fit.ts`), 0 survivant |
| Intégrité | `pnpm integrity develop` | OK |
| Périmètre | `git diff --stat develop...lot/F5c-integration -- apps/api db packages` | vide |
| Garde-fous | `audit.log` : autorisations 2441f410 et b5251c01 | usages limités à `HomePage.spec.ts`, `design-system.e2e.ts`, `cv.fr.ts`, `cv.en.ts`, `map-cv.spec.ts` ; `Justification-test: F5c-OBS` sur e071717 et d69eee6 |

## Fond (lecture de code et parcours verts du check)
- `HomePage.vue` : quatre sections dans les slots, props issues de `view` (profile+links, experiences+techs, recommendations+source, ai) ; `scrollers` branché sur `scroller` exposé de la section XP ; marges d'onglet par variables.
- Un seul `h1` : testé en unitaire (`findAll('h1')` = 1) et dans `sections.e2e.ts` (masqué visuellement, grand titre = `ProfileTitle`).
- Section XP : liste qui défile seule, filtre hors liste (`experience.e2e.ts`, `sections.e2e.ts`) ; `?tech=` suit le changement de langue (sections.e2e) et survit au rechargement et à l'onglet (experience.e2e).
- Padding 28 px Recos/IA, 20 px Profil : test `sections.e2e.ts` ; `AppShell.vue` (1,75 rem).
- Tokens : `--font-size-h3-tile` (1,375 rem), `--dur-egg-line/bar` à 0,01 ms en mouvement réduit (réglage et système) ; `section-tokens.spec.ts`, plus de valeur locale dans `AiSection` et `EasterEggWindow`.
- OpenClassrooms : fixtures `location: null` comme le seed (BF-12) ; « à distance » ne vient plus que du mode de travail, une fois.

## Tests modifiés par le correcteur (avant/après)
- `HomePage.spec.ts` : contenu provisoire (« 8 expériences », `li`) remplacé par un h1 unique, accroches, filtre, liens LinkedIn, titre IA : assertions de langue, h1 et contenu conservées, plus nombreuses.
- `design-system.e2e.ts` : cible `main p` premier (accroche à letter-spacing de maquette) devenue `main .profile__intro` ; mêmes valeurs WCAG 1.4.12 attendues.
- `map-cv.spec.ts` : `'À distance, WM[remote]'` devient `'WM[remote]'`, fixture alignée sur le seed : objet du test inchangé.
- Rien d'affaibli. Ligne `getAnimations().finished` de `experience.e2e.ts` (fichier nouveau, pas un test modifié) : elle n'attend que la fin du glissement avant la mesure de départ ; l'égalité stricte après défilement reste. Avis du correcteur confirmé (sans `subtree: true`, une animation d'ancêtre n'est pas attendue ; suffisant, vert aux 7 tailles).

## Non fait
- Retrait d'un test au hasard : non fait. Mes garde-fous interdisent de modifier un test, même dans un clone, et le créneau machine ne laissait pas de place à une installation neuve.
- Tests de réserve OpenAPI et cycles édition-test (transcription non fournie) : hors périmètre demandé, non faits.

## Verdict : acceptée
Aucune réserve bloquante.
