# Lot F3a : assemblage du front, coquille et données branchées (lead-architecte)

Date : 20 novembre 2026. Branche `lot/F3a-assemblage` (worktree `.claude/worktrees/lot-F3a-assemblage`),
depuis `develop` (71ff6b5). Isolation : `.env` racine `siteperso-v3-f3a`, 5912/5913,
`PLAYWRIGHT_PORT=5914`, `WEB_E2E_PORT=5915` ; API du worktree sur 5916 (`apps/api/.env`, ignoré par
git). Autorisation **676d06a3** utilisée pour `.claude/agents/dev-front.md`, `revue-a11y.md` et
`apps/web/vitest.config.ts` (commits `Justification-test: F3a …`) ; `playwright.config.ts` non
touché. Rien dans `apps/api`, `db`, `packages/contracts`. Journaux : dossier temporaire de session,
préfixe `f3a-`.

## Résumé

Tout est livré et testé, mais **la bascule de `pages/index.vue` vers la vraie page n'est pas
committée** : elle rend faux 10 tests unitaires existants (et des parcours Playwright existants), et
le hook pre-commit (`turbo run lint typecheck test`) refuse alors tout commit. Sortie honorable : la
vraie page est livrée en composant (`components/home/HomePage.vue`, testé à 100 %), et la bascule
(4 fichiers modifiés, 4 tests ajoutés dont le parcours `test/shell.e2e.ts`) est dans
**`docs/comptes-rendus/lot-F3a-bascule.patch`**, à appliquer par le correcteur avec la correction des
tests obsolètes (liste plus bas). Vérifiée appliquée : unitaires (seuls les 10 tests obsolètes
échouent), 147/147 parcours `shell.e2e.ts` aux 7 tailles, génération sur fixtures et sur l'API réelle,
captures.

## Fait (committé)

| Ticket | Livré | Preuve |
|---|---|---|
| Données | `runtimeConfig` privé `cvSource` / `apiBaseUrl` (`NUXT_CV_SOURCE`, `NUXT_API_BASE_URL`), `.env.example`, `app/composables/use-cv.ts` (config lue au `setup`, erreur relevée en `CvReadError` pour que le prérendu affiche la cause) ; `test:e2e` génère sur les fixtures avec l'adresse placeholder ; projet Vitest `nuxt` sur les fixtures (overrides du `runtimeConfig`) | `use-cv.spec.ts` (5), `use-cv-errors.spec.ts` |
| Coquille | `components/shell/AppShell.vue` : un seul jeu d'en-têtes une fois monté (`v-if`, `useShellMode` sur `(min-width: 1024px)`, seuil de `computeLayout`), CSS par requête média avant le montage ; `<main id="contenu">` (défile et focalisable en onglets) ; `h1` + un `h2` par section (masqués visuellement sous 1024 px, le `h1` seulement hors onglet Profil) ; onglets du bas, glissement 64 px dans le sens des onglets (`assets/css/motion.css`, coupé sous mouvement réduit), flèche, barre d'actions ; barre du haut au bureau (focus sur la section choisie, mosaïque en F6). `app.vue` : `usePreferencesSync()` une fois, lien « Aller au contenu » (`common.skipToContent`). `components/home/HomePage.vue` : CV par `useCv`, `mapCv`, contenu provisoire tiré des données (pastille, accroches, intro, « 8 expériences », « 3 recommandations », titre IA), titre « prénom nom · titre » | `AppShell.spec.ts` (12), `useShellMode.spec.ts` (5), `HomePage.spec.ts` (5), `app-root.spec.ts` (3) |
| Contact | Adresse vide ou invalide : `AppShell` lève, `nuxt generate` échoue | `f3a-gen-sans-contact.log`, `f3a-gen-contact-invalide.log` (code 1, « Adresse de contact absente ou invalide : NUXT_PUBLIC_CONTACT_EMAIL… ») ; `AppShell.spec.ts` (3 adresses) |
| D5 | Table unique `domain/root-attributes.ts` (réexportée par `usePreferencesSync`) ; `domain/theme-script.ts` : script ES5 qui embarque en JSON la table, la clé, la version, les valeurs admises et les valeurs par défaut de `defaultPreferences` (aucune règle recopiée), tolère toute erreur ; posé en tête par `nuxt.config.ts` (`tagPriority: 'critical'`) | `theme-script.spec.ts` : exécuté dans `node:vm`, comparé à `rootAttributes(loadPreferences(…))` pour 20 stockages × 4 systèmes, empreinte recalculée ; `boot.e2e.ts` (7 tailles) : application bloquée, attributs et couleurs déjà posés ; avec l'application, chaque attribut posé avant `<body>` et jamais modifié ensuite |
| D15 | `routeRules` `/fr` et `/fr/**` → `/…` (301), `/fr` et `/fr/accessibilite` prérendues : Nitro écrit une page `meta refresh` (`url=/`, chemin conservé) | `boot.e2e.ts` (`/fr`, `/fr/`) ; essai `/fr/en` → `url=/en` |
| D18 | Prop `label` sur `Window` et `Popover` (`aria-label`, `aria-labelledby` retiré) ; slot `trigger` typé (`PopoverTriggerProps` : `'true' \| 'false'`, `'dialog'`), transtypage retiré d'`AccessibilityPanel` | `Popover-label.spec.ts` (3, dont `expectTypeOf`), `Window-label.spec.ts` (2) |
| Suites | Survol néon retiré de la puce pointillé (`:not([aria-disabled='true'], .tech-chip--dashed)`) ; exception D17 dans `dev-front.md` et `revue-a11y.md` | `TechChip-hover.spec.ts` (échoue avec l'ancien sélecteur, vérifié) |
| Annexe | Page provisoire `pages/accessibilite.vue` (le lien du panneau menait à un 404 qui faisait échouer le prérendu : « [404] Page not found: /accessibilite, Linked from / ») | `accessibilite.spec.ts` (2) |
| CLAUDE.md | Section Front : AppShell, HomePage, use-cv, motion.css, D5 et son empreinte, configuration de la source, tests sur fixtures | |

## Dans le correctif de bascule (non committé, `lot-F3a-bascule.patch`)

`pages/index.vue` rend `HomePage` ; `AccessibilityPanel` passe `:label` (« Réglages
d'accessibilité » / « Accessibility settings », D18) ; `LanguageSwitch` (D19) affiche la langue
courante (« FR » sur `/`, « EN » sur `/en`), nom accessible « Passer en anglais » / « Switch to
French » (`shell.language.switchTo.*`, porté par un `span lang` de la page), `lang` et `hreflang` de
la cible sur le lien ; clés `home.*` retirées de `common.json`. Tests ajoutés : `pages/home.spec.ts`,
`LanguageSwitch-d19.spec.ts`, `AccessibilityPanel-label.spec.ts`, **`test/shell.e2e.ts`** (21 tests ×
7 tailles = 147 : structure, axe WCAG 2.2 AA dans les 4 palettes sur chaque section, lien
d'évitement, sections au clavier avec `aria-current`, panneau au clavier (nom, focus, Échap, axe
ouvert), thème et contraste enregistrés puis rechargés sans flash, sélecteur de langue, `/fr`).

Application : `git apply docs/comptes-rendus/lot-F3a-bascule.patch` (vérifié par `git apply
--check` sur la tête de branche), puis correction des tests ci-dessous dans le même commit.

## Tests obsolètes (sortie honorable)

Preuve unitaires, bascule appliquée : `pnpm vitest run` (apps/web) → « Tests 10 failed | 748 passed »
(`f3a-bascule-unit3.log`), exactement :

| Fichier | Test | Exige | Faux parce que |
|---|---|---|---|
| `app/app.spec.ts` | sert la page française sans préfixe… ; sert la page anglaise sous /en… | `h1` « Site en construction » / « Website under construction » | la page d'accueil est la vraie page : `h1` « Développeur full-stack » (reçu). `lang`, hreflang et canonical restent valables |
| `app/pages/index.spec.ts` | les 2 tests | page provisoire (`h1`, lien « Read in English ») | `index.vue` rend `HomePage` |
| `app/components/shell/AccessibilityPanel.spec.ts` | a pour titre visible le nom de fichier accessibilite.cfg | trouve le titre par `aria-labelledby` du dialogue | D18 retire `aria-labelledby` (nom par `aria-label`) ; le titre visible `h2` reste (vérifié par `AccessibilityPanel-label.spec.ts`) |
| `app/components/shell/LanguageSwitch.spec.ts` | affiche le code de la langue cible… ; affiche FR sur la page anglaise ; se nomme « English »… ; se nomme « Français »… ; a un nom accessible qui contient le code visible (2.5.3) | code de la cible, nom = nom de la langue cible | D19 : code de la langue courante, nom = action. Les 2 tests `lang`/`hreflang` restent valables. Voir le point ouvert 2.5.3 |

Parcours Playwright existants, bascule appliquée : `playwright test` → 99 échecs, 349 réussis
(`f3a-bascule-e2e-all.log`) ; tous dans ces tests :

| Fichier : test (tailles en échec) | Faux parce que |
|---|---|
| `smoke.e2e.ts` : les 4 tests (7) | `h1` « Site en construction » attendu |
| `design-system.e2e.ts` : « sans data-theme, la page suit le schéma du système » (7 × 2) | D5 et `usePreferencesSync` posent toujours `data-theme` (CLAUDE.md : « le script de thème D5 le pose toujours ») ; déjà faux sans la bascule (app.vue committé) |
| `design-system.e2e.ts` : « focus visible au clavier » (7 × 2) | le premier arrêt du clavier est le lien d'évitement, plus `a[hreflang="en"]` ; déjà faux sans la bascule |
| `design-system.e2e.ts` : « le lien d'évitement est hors de l'écran… » (7) | ajoute un second `.skip-link` : `locator('.skip-link')` en violation du mode strict ; déjà faux sans la bascule |
| `design-system.e2e.ts` : « taille du texte… » (6) | `h1` de 40 px attendu à toutes les tailles ; la vraie page suit les tokens (46, 60, 40, 50 px) |
| `design-system.e2e.ts` : « souligner les liens » (7) | le seul `a[hreflang]` est le sélecteur de langue (forme de bouton, sans soulignement) |
| `design-system.e2e.ts` : « polices auto-hébergées » (7) | JetBrains Mono est utilisée dès le chargement (nom de fichier des barres) |
| `design-system.e2e.ts` : « data-theme l'emporte… », système clair (3 à 7 selon la passe) ; `controls.e2e.ts` : « contour … (sombre, D12) » (3 à 6) et « (sombre, renforcé, D12) » (4 à 6) | posent les attributs de `<html>` juste après `goto` ; le montage de l'application (`usePreferencesSync`, app.vue) les remet ensuite aux préférences du système (reçu : `rgb(20, 38, 43)`, couleurs du thème clair, au lieu de `rgb(102, 121, 138)`). Course : le nombre de tailles en échec varie d'une passe à l'autre. Ces tests doivent attendre l'hydratation (`.app-shell[data-mode]` après la bascule) ou poser le réglage par le stockage |

Sans la bascule (tête de branche, app.vue committé), échouent déjà : « sans data-theme… » (14),
« focus visible au clavier » (14), « le lien d'évitement est hors de l'écran… » (7) et les tests de
la course ci-dessus : 51 puis 48 échecs dans les deux `pnpm check` (voir « Vérifications »).

## Décisions

- **Vraie page en composant (`components/home/HomePage.vue`) et bascule en correctif** plutôt que dans
  `pages/index.vue` : seul moyen de committer la page et ses tests sans contourner le hook pre-commit.
  Alternative écartée : laisser la page non committée (perdue) ou committer sans hook (interdit).
- **h1 au niveau du contenu** (titre du profil), visible au bureau et dans l'onglet Profil, masqué
  visuellement dans les autres onglets : la page a toujours un `h1` ; la maquette n'en avait pas hors
  du Profil. Au bureau, il est au-dessus des sections jusqu'à la mosaïque (F6).
- **Avant le montage, les deux jeux d'en-têtes sont rendus et la CSS n'en montre qu'un** (le rendu
  statique ignore la largeur) ; `display: none` les retire aussi de l'arbre d'accessibilité. Après
  le montage, `v-if` n'en garde qu'un (notice F3b).
- **`<main>` est la zone qui défile en onglets** (focalisable, `tabindex="0"`) : pas de région
  supplémentaire à nommer ; la flèche est hors de `<main>` dans un parent positionné.
- **Script D5 : configuration en JSON + court interprète**, plutôt que `Function.prototype.toString()`
  des fonctions du domaine (texte dépendant du transpileur, et instrumenté par Stryker) ; l'équivalence
  avec le montage est prouvée par l'exécution du script sur toute la matrice. Mutation 100 %.
- **D19, `lang` de la cible gardé sur le lien** (ticket et 2 tests existants valables) mais le nom,
  écrit dans la langue de la page, porte son propre `lang` : prononciation correcte.
- **Page provisoire `/accessibilite`** plutôt que `prerender.ignore` : pas de lien mort.
- **Erreur de lecture relevée en `CvReadError`** : sans cela, le prérendu n'affiche que « [500] Server
  Error » (vérifié) ; avec, « API injoignable (GET http://127.0.0.1:5919/api/v1/cv?lang=fr) : fetch
  failed (connect ECONNREFUSED 127.0.0.1:5919) ».
- **Projet Vitest `nuxt` sur les fixtures** (overrides du `runtimeConfig`) : le ticket demande les
  tests sur fixtures ; aucun seuil ni aucune sélection touchés.
- Libellés ajoutés (à relire par Julien) : `shell.headings` (Profil, Expérience, Recommandations, IA /
  Profile, Experience, Recommendations, AI), `experience.present` (aujourd'hui / present),
  `breakOrganisation`, `workMode` (sur site, hybride, à distance / on-site, hybrid, remote),
  `contractType` (CDI, Freelance / Permanent, Freelance), `*.provisional.count`, `declaration.*`,
  `shell.language.switchTo.*` (dans le correctif).

## Captures et libellés pour Julien

Hors dépôt, bascule appliquée, fixtures : `/tmp/claude-1000/-home-jlachaux-IA-PROJECTS-site-perso-personnalWebsite-V3/adc7d6bb-d6ca-4961-bd2a-09cd85b57ef1/scratchpad/f3a-captures/`
(`mobile-390_fr_clair.png`, `mobile-390_fr_sombre.png`, `mobile-390_fr_accessibilite-ouvert_clair.png`,
`desktop-1280_fr_sombre.png`, `desktop-1280_en_sombre.png`). Sujet du `mailto` affiché :
« Prise de contact depuis votre site » (en : « Getting in touch from your website ») ; onglet Recos en
anglais : « Recs ».

## Génération (bascule appliquée)

| Cas | Commande | Résultat |
|---|---|---|
| Fixtures | `NUXT_CV_SOURCE=fixtures NUXT_PUBLIC_CONTACT_EMAIL=contact@example.org nuxt generate` | code 0, `/`, `/en`, `/accessibilite`, `/en/accessibilite`, `/fr`, `/fr/accessibilite` |
| API morte | `NUXT_CV_SOURCE=api NUXT_API_BASE_URL=http://127.0.0.1:5919 …` | **code 1**, « API injoignable (GET …/api/v1/cv?lang=fr) : fetch failed (connect ECONNREFUSED …) », « Exiting due to prerender errors » |
| API du worktree (`db:reset` sur les seeds, `pnpm --filter @siteperso/api dev`, port 5916) | `NUXT_CV_SOURCE=api NUXT_API_BASE_URL=http://127.0.0.1:5916 …` | **code 0** : `/` `lang="fr"`, `h1` « Développeur full-stack », « 8 expériences », « 3 recommandations », titre IA ; `/en` `lang="en"`, « Full-stack developer », « 8 experiences » ; identité réelle du seed (plus de « Prénom Nom ») ; aucune valeur privée (port, URL) dans `.output/public` (seuls les noms de propriétés dans le code). API puis `sirv` arrêtés |

## Vérifications (tête de branche, sans la bascule)

| Critère | Commande | Résultat |
|---|---|---|
| Format | `pnpm format` | code 0, aucun fichier modifié |
| Check, passe 1 | `docker compose down -v` puis `TURBO_FORCE=true pnpm check` (`f3a-check-1.log`) | **code 1, uniquement des parcours Playwright existants obsolètes** : hooks 569/569, intégrité OK, lint, typecheck, unitaires (contrats 220, API 430, front 754) verts ; `web:test:e2e` 250 réussis, 51 échecs, tous listés plus haut ; turbo interrompt alors `api:test:e2e` et `pnpm check` ne lance pas la couverture |
| Check, passe 2 | `docker compose down -v` puis `TURBO_FORCE=true pnpm check` (`f3a-check-2.log`) | même résultat : 253 réussis, 48 échecs, mêmes tests (seul varie le nombre de tailles des tests de la course) |
| Étapes interrompues | `TURBO_FORCE=true pnpm turbo run test:e2e --filter=@siteperso/api` puis `TURBO_FORCE=true pnpm turbo run test:coverage` | code 0 : e2e API 758/758 ; couverture 100 % partout (front 802/802 instructions, 444/444 branches, 245/245 fonctions, 716/716 lignes ; contrats et API inchangés) |
| Nouveaux parcours | `boot.e2e.ts` dans les deux passes | 49/49 aux 7 tailles |
| Mutation front | `pnpm --filter @siteperso/web test:mutation` (`f3a-mutation.log`) | **100,00 %** (seuil 100) : 929 tués, 1 délai dépassé (`fit.ts`, déjà là), 0 survivant ; `theme-script.ts` 31 tués, `root-attributes.ts` 34 tués ; aucune directive ni équivalent |
| Intégrité | `pnpm integrity develop` | « HEAD comparé à develop (point de divergence 71ff6b5ca636) », « Intégrité des tests : OK » |
| Bascule appliquée | `git apply docs/comptes-rendus/lot-F3a-bascule.patch`, `pnpm vitest run`, `playwright test`, puis `git apply -R` | unitaires : 10 échecs, tous obsolètes (`f3a-bascule-unit3.log`) ; `shell.e2e.ts` 147/147 (`f3a-shell-e2e-2.log`) ; tous les parcours : 349 réussis, 99 échecs obsolètes (`f3a-bascule-e2e-all.log`) |

Note d'intégrité : un premier `pnpm check` a refusé le changement du script `test:e2e` de
`apps/web/package.json` (commit db61d32 sans `Justification-test`). Corrigé par le commit 92f6d74
(script dédié `generate:fixtures`, avec la ligne de justification), sans réécrire l'historique.

## Points ouverts

1. **Bascule à appliquer** par le correcteur avec les tests obsolètes ci-dessus (un seul commit).
   Après elle, la couverture devra être remesurée (non mesurable tant que des tests échouent).
2. **CI `qualite`, `pnpm build`** : après la bascule, `nuxt generate` sans configuration échoue (adresse
   de contact vide, source `api` sans URL) — c'est voulu en production. Le job doit poser
   `NUXT_CV_SOURCE=fixtures` et `NUXT_PUBLIC_CONTACT_EMAIL=contact@example.org` (ou une API) :
   `.github/workflows/` protégé, hors autorisation. Turborepo hache bien les `NUXT_*` (inférence du
   cadre Nuxt, mode `strict` vérifié par `--dry=json` et une génération sur fixtures par `turbo run
   build`).
3. **F9, CSP** : script de thème `'sha256-nzuLVqI8ekzAXFcdRbwjQkxQig8MPDlNQ5+0PkfBJwY='`
   (`THEME_SCRIPT_SHA256`, recalculé par `theme-script.spec.ts` ; identique au texte du HTML généré).
   Nuxt pose aussi deux scripts en ligne exécutables dont le contenu dépend de chaque build :
   `<script type="importmap">` (noms des fichiers) et `window.__NUXT__={…config…}` (configuration
   publique) : empreintes à calculer après `nuxt generate` (ou retrait par configuration à étudier),
   plus 19 `<style>` en ligne (`style-src`). `__NUXT_DATA__` (`application/json`) n'est pas exécuté.
4. **F9, Caddy** : doubler D15 par une redirection HTTP `301` de `/fr` et `/fr/*` vers le chemin sans
   préfixe (aujourd'hui page `meta refresh`, statut 200).
5. **D19 et WCAG 2.5.3** : le nom « Passer en anglais » ne contient pas le texte visible « FR » ;
   « FR » indique un état, pas l'action, mais un audit peut le relever (proposition : « FR, passer en
   anglais »). `lang` de la cible sur un lien dont le contenu est dans la langue de la page : inutile
   pour la prononciation (le nom porte son `lang`), à retirer si Julien l'accepte.
6. **Poids du client** : le gestionnaire de `useCv` (sources, fixtures, schémas Zod) est dans le
   paquet JavaScript de la page (473 ko de JS au total) alors qu'il ne sert qu'au build ; à isoler
   côté serveur (import dynamique sous `import.meta.server`) avant F9.
7. **CV PDF** : `public/cv/` n'existe pas, le bouton « CV PDF » mène à un 404 (`/cv/cv-fr.pdf`).
8. **Barre du haut** : sans mosaïque (F6), choisir une section met le focus dessus ; la hauteur
   mesurée pour `computeLayout` (notice F3b) reste à faire en F6.
9. **Tests de `design-system.e2e.ts` et `controls.e2e.ts` qui posent les attributs après `goto`** :
   course avec le montage (ligne du tableau ci-dessus) ; le correcteur doit les faire attendre
   l'hydratation (`.app-shell[data-mode]`) ou passer par le stockage.
