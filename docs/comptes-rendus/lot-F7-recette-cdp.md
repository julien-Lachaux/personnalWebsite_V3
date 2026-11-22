# Lot F7 : recette du chef de projet

Date : 21 novembre 2026. PR #5 `lot/F7-annexes` → develop, tête `ad028a4`. Recette sans `pnpm check`
local : la CI de la PR est l'unique vérification complète.

## Verdict : accepté avec réserves

Le fond du lot est conforme. Un seul point rouge en CI : le job Front, sur un test de `shell.e2e.ts`
que le lot ne touche pas et qui échoue aussi sur develop. À relancer ou à corriger hors lot avant fusion.

## CI de la PR (run `pull_request` 44935098658)

| Job | Résultat |
|---|---|
| Qualité, Tests e2e et couverture 100 %, mutation contrats / API / front, analyse statique, image Docker, garde-fous (intégrité, hooks), pile locale | vert |
| Front (lint, typecheck, couverture 100 %, Playwright + axe) | **échec** |

Front : lint, typecheck, couverture (108 fichiers, 1046 tests) verts ; Playwright 1119 réussis, 1 échec :
`[mobile-390] test/shell.e2e.ts:115 fr (/) axe, palette clair, onglet IA` (color-contrast, `#6c60bd` sur
`#e6ebe5` = 4,29:1, cible `#v-0-43-product`). Aucun des tests du lot (`pages.e2e.ts`) n'échoue.

Le même test échoue sur la CI de develop à `9f66ac8` (run 44935045976, 3 échecs : onglet Recos/Recs en
390 et 834). Défaut intermittent et antérieur au lot (le lot ne touche aucun CSS ni `shell.e2e.ts`),
probablement une mesure de contraste pendant la transition de l'onglet. À traiter à part (correcteur ou
lot front dédié) ; je ne l'ai pas rejoué en local (règle de la recette).

Revue Claude (run 44935098665) : `VERDICT: OK`. Constats non bloquants : `title` en dur sur un composant
non relevé par `i18n-hardcoded.spec.ts` (réserve du correcteur) ; `robots.txt` et `sitemap.xml` prennent
l'origine du canonique (`localhost:3001` sans `NUXT_PUBLIC_I18N_BASE_URL`, reporté à BF-14) ; le fichier
`lot-F7-tests.patch` est redondant avec l'historique ; Caddyfile à compléter (BF-14, F9).

## Contrôles locaux

- `pnpm integrity develop` : OK.
- Périmètre : aucun fichier dans `apps/api`, `db`, `packages/contracts`.
- Tests : seul test existant modifié, `HomePage.spec.ts` (`/en/accessibilite` → `/en/accessibility`, D23,
  une assertion, valeur attendue alignée sur la décision). Les cinq autres fichiers sont créés par le lot
  et corrigés (types, isolation de langue `beforeEach`, lint) sans assertion retirée. Commits porteurs de
  `Justification-test: F7-TESTS`. Audit : autorisation c67011fa, usages limités aux 6 chemins prévus.
- Réserve jugée sur `i18n-hardcoded.spec.ts` : le filtre `tagType` natif ne relève plus un `title` en dur
  sur un composant (`BaseWindow`, `Popover`). Affaiblissement réel mais borné (props de composants, témoin
  de test ajouté, liste des textes en dur vide, la 2e protection e2e « aucun libellé français sur /en »
  passe sur `/en`, `/en/accessibility`, `/en/unknown-page`). Accepté ; à renforcer plus tard.
- Génération ciblée (`generate:fixtures`, code 0, 15 routes) : `robots.txt` (Allow + Sitemap) et
  `sitemap.xml` (4 URL avec hreflang fr, en, x-default) corrects ; `404.html` et `en/404.html` générés,
  `lang` juste, `noindex`, titres « Page introuvable » / « Page not found » ; déclaration fr et en avec
  titre, description, Open Graph, canonique et hreflang propres à la page ; contact en `mailto:` vers le
  placeholder `contact@example.org` (aucune adresse en clair dans le HTML ni le code).
- Déclaration d'accessibilité : rubriques du modèle RGAA, état « non conforme » sans taux inventé faute
  d'audit, liste de défauts vide assumée, voies de recours du Défenseur des droits, mention provisoire.
  Version anglaise sans chaîne française, hors noms propres (Défenseur des droits, adresse postale).
- Aucune donnée personnelle hors exception D22.

## Points ouverts

1. Décider : relancer la CI (le test est intermittent) ou ouvrir un correctif du test de contraste de
   `shell.e2e.ts` avant fusion ; develop est rouge pour la même raison.
2. Serveur de production : 404 par langue avec statut 404, `robots.txt` et `sitemap.xml` à la racine
   (BF-14, F9). Les e2e émulent le proxy.
3. Contenu de la déclaration provisoire à valider par Julien (`docs/front-a-traiter-par-julien.md`).
4. Origine du sitemap sans `NUXT_PUBLIC_I18N_BASE_URL` : refuser `localhost` hors fixtures (revue).
