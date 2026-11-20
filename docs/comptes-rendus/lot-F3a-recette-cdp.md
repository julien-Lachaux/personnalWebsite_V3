# Lot F3a : recette du chef de projet

Date : 20 novembre 2026. Branche `lot/F3a-assemblage` (37379b4), base develop 71ff6b5.

## Verdict : accepté avec réserves

## Critères rejoués

| Critère | Commande | Résultat |
|---|---|---|
| Check sur conteneurs neufs | `docker compose down -v` puis `TURBO_FORCE=true pnpm check` | code 0 : contrats 220, API 430 unitaires + 758 e2e, front 758 unitaires + 448 parcours Playwright ; 4 tâches sur 4 sans cache |
| Couverture | `pnpm test:coverage` (dans check) | 100 % partout ; front 797/797 instructions, 458/458 branches, 244/244 fonctions, 712/712 lignes |
| Mutation front | `pnpm --filter @siteperso/web test:mutation` | 100,00 % (929 tués, 1 délai dépassé, 0 survivant), code 0 |
| Intégrité | `pnpm integrity develop` | OK |
| Périmètre | `git diff --name-only develop...HEAD -- apps/api db packages` | 0 fichier |
| Marqueurs | recherche de skip, only, todo, fixme, fails, ignore v8/c8/istanbul, Stryker disable, ts-ignore dans les lignes ajoutées | aucun |
| Génération, API morte | `NUXT_CV_SOURCE=api NUXT_API_BASE_URL=http://127.0.0.1:5919 nuxt generate` | code 1, « API injoignable (GET …/cv?lang=fr) : fetch failed (connect ECONNREFUSED) » |
| Génération sans contact / contact invalide | `NUXT_PUBLIC_CONTACT_EMAIL=` puis `=pas-une-adresse` | codes 1, « Adresse de contact absente ou invalide : NUXT_PUBLIC_CONTACT_EMAIL doit être une adresse e-mail » |
| Génération sur l'API du worktree (seeds, `db:reset`) | `NUXT_CV_SOURCE=api NUXT_API_BASE_URL=http://127.0.0.1:5916 …` | code 0 ; `/` lang fr, h1 « Développeur full-stack », « 8 expériences » (= 8 expériences du `GET /cv`) ; `/en` lang en, h1 « Full-stack developer » |
| Données privées | grep des adresses e-mail, `postgres://`, `DATABASE_URL`, `127.0.0.1`, `5916` dans `.output/public` | une seule adresse (`contact@example.org`, 10 occurrences) ; aucune valeur privée |
| D5 | `playwright test test/boot.e2e.ts --project=desktop-1280` | 7/7 : attributs posés avant `<body>`, thème sans flash, document illisible. Empreinte `sha256-nzuLVqI8…` : identique dans `theme-script.ts`, recalculée sur le script du HTML généré, et vérifiée par `theme-script.spec.ts` |
| D15 | HTML généré + `boot.e2e.ts` | `/fr` et `/fr/` renvoient vers `/` ; `/fr/accessibilite` contient `meta refresh url=/accessibilite`. Réserve : c'est une page 200 `meta refresh`, pas un 301 HTTP (doublé par Caddy en F9, déjà noté par le lead) |
| D18 | HTML généré | `role="dialog" aria-label="Réglages d’accessibilité"`, titre visible `accessibilite.cfg` |
| D21 | HTML généré | `FR` en `span aria-current="true" lang="fr"`, séparateur `aria-hidden`, `<a href="/en" lang="en" hreflang="en">EN</a>` sans `aria-label` : nom accessible = texte visible |
| CI | `git diff develop...HEAD -- .github/workflows/ci.yml` | +7 lignes : un commentaire et deux blocs `env:` (`NUXT_CV_SOURCE: fixtures`, `NUXT_PUBLIC_CONTACT_EMAIL: contact@example.org`) sur `qualite/pnpm build` et `front/pnpm turbo run … --filter=@siteperso/web` ; rien d'autre |

## Autorisations et journal des garde-fous

- 676d06a3 (lead) : usages sur `dev-front.md`, `revue-a11y.md`, `vitest.config.ts`, dans ses chemins ; `playwright.config.ts` non modifié. Refus du lead : écritures opaques (python3) et cible illisible, aucune insistance sur le même refus.
- e925558a (correcteur, F3a-OBS) : 7 fichiers, tous dans les chemins accordés. 38507e7b (F3a-D21) : `LanguageSwitch.spec.ts`, `LanguageSwitch-d19.spec.ts`, `shell.e2e.ts`, `index.spec.ts`, `app.spec.ts` : dans les chemins. Un refus du correcteur (python3 opaque, cible illisible), pas de tentative répétée.
- 9678aeda (devops) : deux Edit sur `ci.yml` seulement.
- Chaque commit qui touche un test existant ou une configuration protégée porte `Justification-test` (778253b F3a-OBS, 2c99498 F3a-D21, 37379b4 F3a-CI, 1accc6c, 92f6d74, cae48f5). Le triage est sauté sur décision de Julien (consignée).
- Réserve de forme : la justification de 778253b cite « 10 tests unitaires et 6 parcours » ; le compte rendu du lead recense 99 échecs de parcours sur 7 tailles. Cohérent (6 tests distincts × tailles) mais l'énoncé est elliptique.

## Tests obsolètes : échantillon comparé (avant / après)

| Test | Verdict |
|---|---|
| `app.spec.ts` (2) | Même comportement (lang, hreflang, canonical, h1 unique par page et langue) sur la vraie page. Le `beforeEach` pose la config et des doubles de `matchMedia`/`document.fonts`, restaurés en `afterEach` : pas d'état caché. Pas affaibli. |
| `index.spec.ts` (2) | h1 unique conservé, lien d'autre langue avec `href`, `lang`, `hreflang` conservés ; texte « EN »/« FR » (D21). Resserré (un seul `a[hreflang]`). Pas affaibli. |
| `AccessibilityPanel.spec.ts` titre | Le titre `h2` « accessibilite.cfg » est toujours vérifié ; le lien `aria-labelledby` est remplacé par `aria-label` exact + `aria-labelledby` absent (D18). Pas affaibli. |
| `LanguageSwitch.spec.ts` | Le test WCAG 2.5.3 supprimé est rétabli dans l'esprit par « nomme le lien par son texte visible, sans aria-label » (D21), plus `aria-current`, `lang`, séparateur. Renforcé. |
| `design-system.e2e.ts` « sans data-theme » | L'assertion d'origine (repli CSS sans attribut) est gardée, après retrait explicite de l'attribut, et D5 est ajouté. Pas affaibli. |
| `design-system.e2e.ts` « focus visible » | Contour mesuré sur le 2e arrêt de Tab au lieu du lien de langue ; `not skip-link` est une garde faible (n'importe quel contrôle), mais le contour est identique. Affaiblissement léger. |
| `design-system.e2e.ts` « taille du texte » | Plus de h1 figé à 40 px : `baseHeading > 0` puis rapport exact ×1,15 et ×1,3. La mise à l'échelle reste prouvée, la valeur absolue du token n'est plus testée ici (couverte par `tokens.spec.ts`). Affaiblissement léger, justifié. |
| `design-system.e2e.ts` « polices », `smoke.e2e.ts`, `controls.e2e.ts` | `open()` attend `.app-shell[data-mode]` (déterministe, aucun délai) ; assertions inchangées ou plus précises. Pas affaibli. |

## Cycles édition-test

Fichiers les plus modifiés : `nuxt.config.ts` 5 commits, `shell.json`/`common.json` 3. Aucun fichier de test au-dessus de 5 cycles. Transcription non fournie : alternances non comptées.

## Retrait de tests au hasard (clone jetable, contrats compilés)

1. Tirage `shuf` : `theme-script.spec.ts`, « a pour empreinte CSP THEME_SCRIPT_SHA256 ». Retiré : `vitest run --coverage` du front code 0, 757 tests verts, couverture 100 %. **Non détecté.** Cause : test d'assertion pure sur une constante déjà couverte par l'import ; c'est pourtant la seule garde de l'empreinte CSP (F9). La couverture ne la protège pas, la mutation non plus (le test est celui qui tue le mutant de la constante).
2. Deuxième tirage : `AppShell.spec.ts`, « la barre du haut met le focus sur la section choisie… ». Retiré : code 1, seuil 100 % rompu (`AppShell.vue` fonctions 66,66 %, lignes 86-87 et 108). Détecté.

## Tests de réserve contre l'API

Non exécutés : le lot ne touche ni `apps/api`, ni `packages/contracts`, ni `db` (0 fichier) ; l'API des seeds n'a servi qu'à la génération. Rien à couvrir de nouveau.

## Réserves

1. L'empreinte du script de thème n'est détectée que par son test dédié (voir retrait 1) ; acceptable, à ne pas supprimer.
2. D15 en `meta refresh` (200) en attendant Caddy F9 ; `/fr/x` n'est testé en navigateur que pour `/fr` et `/fr/`, `/fr/accessibilite` vérifié par le HTML généré.
3. « Focus visible » : garde `not skip-link` faible (voir tableau).
4. Points ouverts du lead à arbitrer ensuite : poids du client (473 ko de JS, gestionnaire `useCv` embarqué), CV PDF absent (404), scripts en ligne et `<style>` pour la CSP (F9), `pile-locale` à revoir en F9. `actionlint` non épinglé par digest (devops).

## Nettoyage

API arrêtée, `pnpm db:down` fait (aucun conteneur f3a restant), clone supprimé. `apps/web/.output` et `reports/` (ignorés par git) restent dans le worktree : la suppression de `.output` m'est refusée par les garde-fous.
