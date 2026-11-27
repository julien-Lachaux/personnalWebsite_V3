# Lot F11 : optimisation du front (lead-architecte)

Date : 26 novembre 2026. Branche `lot/F11-optimisation` (worktree `personnalWebsite_V3-f11`), depuis
`develop` (567527c). Isolation : projet compose `siteperso-v3-f11`, Playwright 6020, site e2e 6021,
PostgreSQL 6022/6023, `TEST_MAX_WORKERS=2`. Règle D26 : vérifications ciblées, pas de `pnpm check`.
Aucun test existant modifié, aucune configuration protégée touchée.

## F11-01 : poids du JavaScript client

### Commits

| Commit | Objet |
|---|---|
| b64acd4 | `perf(web)` : source du CV absente des scripts du site généré (`browser-cv-source.ts`, greffon de `nuxt.config.ts`) |
| 8495e07 | `perf(web)` : fixtures du CV importées seulement par la source « fixtures » |
| 9d2548d | `test(web)` : parcours `test/client-bundle.e2e.ts` |
| (ce commit) | `docs` : CLAUDE.md (CSP stricte, lot F11) et ce compte rendu |

### Fait

- **Source du CV hors du navigateur** (RC-2 = RS-3 de la revue du 23 nov.). Cause confirmée :
  `fetch-cv.ts` importe `select-cv-source.ts` à la demande dans le gestionnaire de `useAsyncData`, et
  Vite en faisait un morceau client publié (`k2bm6MiX.js`, 138 603 o : schémas Zod, source API, les
  deux fixtures), atteignable par l'import dynamique, avec la source `api` comme `fixtures`.
  Correction : un module Nuxt en ligne de `nuxt.config.ts` (`siteperso:browser-cv-source`) ajoute au
  seul build client (`addVitePlugin(…, { server: false })`), et seulement sous `nuxt generate`
  (`nitro.static`), un greffon `resolveId` qui résout `./select-cv-source.js` vers
  `app/data/browser-cv-source.ts`. Ce module a la signature de `createCvSource` (typée par
  `typeof`) et lève une `CvSourceError` `config` : « Le CV n'est lu qu'à la génération du site : dans
  le navigateur, il vient de la charge utile de la page ». Le morceau publié tombe à 316 o. Le
  prérendu (build serveur) garde le module réel : pages et charges utiles inchangées.
- **Fixtures à la demande** : `FixtureCvSource` importe `fixtures/cv.{fr,en}.ts` à sa première
  lecture (constructeur facultatif) au lieu de l'import statique par `select-cv-source.ts` ; une
  génération sur l'API ne les charge plus, même côté serveur.
- **Commentaire faux corrigé** dans `fetch-cv.ts` (RC-2, RC-10) : l'import à la demande évite
  l'évaluation, pas la publication ; la publication est évitée par le remplacement.
- **Test** `test/client-bundle.e2e.ts` (nouveau, 8 tests × 7 projets) :
  - relit `_nuxt/*.js` des deux sites que `test:e2e` génère : `.output/public` (source `fixtures`) et
    `node_modules/.cache/site-sans-ia` (source `api`, `generate:without-ai`) ; aucun ne contient Zod
    (`._zod.`, `ZodError`), la lecture du CV (`/api/v1/cv`, « Réponse non conforme au contrat Cv »),
    ni l'un des 20+ textes de 40 caractères ou plus des fixtures ;
  - témoins : les marques Zod sont vérifiées sur `CvSchema` réel, les marques de lecture dans leurs
    fichiers source, les textes des fixtures contiennent les deux `profile.intro` ;
  - trois navigations côté client après hydratation (`/` → `/en` par le sélecteur de langue,
    `/accessibilite` → `/` par l'en-tête, `/travaux` → `/en/work-in-progress`, lot 31) : contenu de
    l'arrivée affiché (intro du CV, lien LinkedIn anglais), un seul document chargé, `_payload.json`
    de l'arrivée demandé, script de remplacement (`browser-cv-source`) jamais demandé, aucune
    exception.
- CLAUDE.md, « CSP stricte (lot F9a) » : remplacement du lot F11 et règle qui le garde efficace (hors
  de `select-cv-source.ts`, le code du navigateur n'importe de `@siteperso/contracts` que des types).

### Mesures (build `generate:fixtures`, script `measure.mjs`, gzip -9)

| | Avant (567527c) | Après |
|---|---|---|
| `_nuxt/*.js` publiés | 12 fichiers, 533 741 o / 175 029 o gzip | 12 fichiers, 395 454 o / 140 737 o gzip |
| Morceau de la source du CV | `k2bm6MiX.js` 138 603 o / 34 534 o, [fixtures] [zod] | 316 o (`browser-cv-source`) |
| JS chargé par `/` et `/en` (7 modulepreload, dont le script d'entrée) | 389 580 o / 137 762 o gzip | 389 580 o / 137 760 o gzip |
| Préchargement `prefetch` de `/` | 852 o | 852 o |
| JS chargé par `/accessibilite` | 333 546 o / 121 005 o gzip | 333 546 o / 121 003 o gzip |
| Site source `api` (`site-sans-ia`) | morceau Zod + fixtures publié | 395 454 o / 140 737 o gzip, ni Zod ni fixtures |

Gain : 138 287 o bruts (−25,9 %) et 34 292 o gzip (−19,6 %) publiés en moins. Le JS chargé par une
page ne change pas : le morceau n'était plus préchargé (constat de l'orchestrateur), il n'était
téléchargé que si le gestionnaire s'exécutait dans le navigateur. Le « ~472 ko » du constat additionne
le script d'entrée deux fois (il est aussi dans les 7 modulepreload).

Mesures complètes : `js-before-fixtures.txt` et `js-after-fixtures.txt`, dans le dossier temporaire de la
session (jetables, non conservés) ; les chiffres utiles sont repris ci-dessus.

### Preuves des critères

| Critère | Commande | Résultat |
|---|---|---|
| Test rouge avant la correction | `pnpm exec playwright test client-bundle --workers=2 --project=mobile-390` sur le build de 567527c | 4 échecs : `k2bm6MiX.js : ._zod.`, `ZodError`, 84 textes des fixtures, pour les deux sources ; témoins verts |
| Aucun script avec Zod ou fixtures, deux sources | `pnpm --filter @siteperso/web test:e2e` (génère les deux sites), puis `pnpm exec playwright test --workers=2 test/client-bundle.e2e.ts …` | 56/56 verts dans `client-bundle.e2e.ts` |
| Le témoin de navigation détecte un gestionnaire exécuté | sonde jetable (non versionnée) : `_payload.json` refusé par `page.route`, puis `/` → `/en` | script de remplacement demandé, `CvReadError: Le CV n'est lu qu'à la génération du site…` |
| API injoignable : la génération échoue, sans repli | `NUXT_CV_SOURCE=api NUXT_API_BASE_URL=http://127.0.0.1:6029 NUXT_PUBLIC_CONTACT_EMAIL=contact@example.org pnpm exec nuxt generate` | code 1, « API injoignable (GET http://127.0.0.1:6029/api/v1/cv?lang=en) : fetch failed (connect ECONNREFUSED …) » |
| Prérendu inchangé | `grep -c Prénom .output/public/index.html` ; serveur : `select-cv-source-*.js` dans `.nuxt/dist/server` | contenu des fixtures dans les pages ; module réel côté serveur |
| Parcours touchés + CSP | `pnpm exec playwright test --workers=2` sur `client-bundle`, `csp`, `work-in-progress`, `pages`, `cv`, `ai-placeholder`, `language-switch-d43`, `boot`, `smoke`, `journeys` | 658 passés (5,1 min) |
| Lint, typecheck | `pnpm --filter @siteperso/web lint`, `typecheck` | verts (aussi au pre-commit) |
| Couverture | `pnpm --filter @siteperso/web test:coverage` | 139 fichiers, 1 190 tests, 100 % sur les quatre métriques |
| Mutation des fichiers touchés | `pnpm exec stryker run --mutate app/data/browser-cv-source.ts,app/data/fixture-cv-source.ts,app/data/fetch-cv.ts` | 36 mutants tués sur 36, score 100 |
| Intégrité | `pnpm integrity develop` | OK |

Incident de vérification : un premier lancement `pnpm --filter @siteperso/web test:e2e -- --workers=2
<fichiers>` a transmis `--` tel quel à Playwright, qui a ignoré les fichiers et `--workers=2` (2 471
tests, 8 workers). Je l'ai interrompu (SIGINT au lanceur Node de l'hôte, ni conteneur ni podman
touchés) après 1 520 tests verts ; les 8 échecs relevés sont ceux interrompus par l'arrêt (« Test was
interrupted », « Target page, context or browser has been closed »). Les parcours ont ensuite été
relancés par `pnpm exec playwright test --workers=2 <fichiers>` sur les sites déjà générés.

### Décisions

- **Remplacement au build plutôt que `import.meta.server`** (piste du ticket). Motif : l'application
  des tests Vitest (`@nuxt/test-utils`) est construite avec la configuration Vite du client
  (`ssr: false`, `import.meta.server` remplacé par `false`, `@nuxt/vite-builder`), et
  `use-cv.spec.ts`, `HomePage.spec.ts` et les autres tests de composants exécutent le gestionnaire
  dans ce contexte : une garde `import.meta.server` les aurait fait échouer (tests existants, non
  modifiables) et laissé une branche jamais couverte. Une garde qui reconnaît l'environnement de test
  (`import.meta.test`, `VITEST`) est un état caché qui reconnaît les tests : écartée. Le remplacement
  est décidé par la nature du build (`nitro.static`, posé par `nuxt generate` seul), pas par les
  tests ; `nuxt dev` garde le comportement actuel. Alternative écartée : alias `vite.$client`, qui
  s'appliquerait aussi à l'application de test.
- **Module de remplacement qui échoue plutôt qu'un module vide** : si une charge utile manquait, la
  page échoue avec un message qui dit pourquoi (même résultat qu'avant, où la configuration privée
  absente du navigateur donnait « URL de base de l'API absente »), jamais un repli.
- **`nitro.static` plutôt que `nuxt.options._generate`** : `_generate` n'est pas dans le type public
  de `NuxtOptions` (erreur TS2339) ; `nitro.static` est l'option publique que la CLI pose avec lui
  (`@nuxt/cli`, `build` : `_generate: prerender`, `nitro.static: prerender`).
- **Compilateur de messages de vue-i18n conservé** (point 2 du ticket) : pas sûr, voir ci-dessous.

### Non fait : compilateur de messages de vue-i18n

Étude faite, changement non appliqué. Avec `@nuxtjs/i18n` 10.6.0, le navigateur ne reçoit pas des
messages précompilés : il télécharge `/_i18n/<empreinte>/<langue>/messages.json` (route Nitro prérendue,
`runtime/context.js`), qui contient les libellés en chaînes brutes (`"expand":"Agrandir {name}"`). Le
plugin `@intlify/unplugin-vue-i18n` ne précompile que les fichiers importés par un build, pas cette
route. Sans compilateur, `compileMessageFormat` de `@intlify/core-base` rend la chaîne telle quelle
(« translate function returns the message as is »). Or les libellés en ont besoin : 31 interpolations
(`common` 7, `experience` 23, `shell` 1) et 7 pluriels en `|` (`experience`) en français.

Preuve (essai jetable, non versionné, `nuxt.config.ts` restauré par `git checkout`) :
- `i18n.bundle.runtimeOnly: true` : aucun effet mesurable (395 454 o, morceau `B7K1EYRD.js`
  identique à l'octet) ;
- `i18n.bundle.dropMessageCompiler: true` : 379 264 o / 135 917 o gzip (−16 190 o / −4 820 o gzip),
  mais dans le navigateur (sonde Playwright à 1280) : « Hydration completed but contains
  mismatches », `SyntaxError: 24` (vue-i18n `UNEXPECTED_RETURN_TYPE`) sur `/`, `/en`,
  `/accessibilite`, et un texte brut « Code de l'erreur : {status} » / « Error code: {status} ».

Le compilateur (`@intlify/message-compiler`, 19 694 o / 5 840 o gzip minifié) n'évalue pas de code
(compilation JIT par AST, aucune violation de la CSP stricte, `csp.e2e.ts` vert).

### Points ouverts

- **Compilateur de vue-i18n** (−16 Ko bruts, −4,8 Ko gzip au mieux) : possible seulement si les
  messages arrivaient précompilés dans le navigateur, ce que `@nuxtjs/i18n` 10.6 ne propose pas pour
  sa route `messages.json`. Pistes, chacune à décider : messages importés dans le bundle client
  (précompilés par le plugin) au lieu de la route, au prix de leur poids dans le JS ; ou attendre une
  option du module. Gain faible au regard du risque : je recommande de ne rien faire.
- **Gains relevés en lisant les morceaux, non faits** :
  - `i18n.bundle.fullInstall: false` retirerait `<i18n-t>`, `<i18n-d>`, `<i18n-n>` et `v-t` ; mais
    `<i18n-t>` sert dans `AccessibilityPanel.vue` (section shell) et `pages/accessibilite.vue` : il
    faudrait l'importer explicitement (`Translation` de `vue-i18n`) dans ces fichiers, puis mesurer. Gain
    non mesuré, probablement quelques Ko ; touche un fichier de section (shell).
  - Le morceau `C4uMlJs9.js` (52 Ko, sections de l'accueil dont `ExperienceSection`) et `BnNSj-6g.js`
    (13 Ko, qui contient notamment `AccessibilityPanel`) sont préchargés par `/` : charger le panneau d'accessibilité à
    l'ouverture (composant asynchrone) allégerait le premier chargement, mais change le moment
    d'affichage du panneau : à décider, avec les captures du handoff.
- Aucun autre gain évident sans effet visible : les autres morceaux font moins de 8 Ko.

## F11-02 : saut à l'hydratation (D49)

Reprise après le redémarrage de la machine (vers 15 h 57) : le travail non commité était intact ; la
décision est D49 (D48 pris par le lot 35, renumérotation `6510b49`). Navigateurs indisponibles
pendant le lot 35, puis rendus par l'orchestrateur : tous les parcours ci-dessous ont été lancés.

### Commits

| Commit | Objet |
|---|---|
| dcbb7fd | `fix(web)` : bouton LinkedIn à 56 px dès la page générée (spécificité du style de section) |
| 53b2e9d | `perf(web)` : mosaïque dessinée avant le montage (`AppShell`, `TileGrid`, garde-fou Vitest) |
| 8496929 | `test(web)` : parcours `test/hydration-shift.e2e.ts` |
| (ce commit) | `docs` : CLAUDE.md (mosaïque avant le montage) et ce compte rendu |

### Fait

- **Mosaïque dès la page générée.** `AppShell` rend `TileGrid` tant que le mode n'est pas `tabs`
  (`v-if="mode !== 'tabs'"`, au lieu de `mode === 'mosaic'`) : la page générée contient les quatre
  tuiles avec leur barre de titre et leur bouton. Au bureau, l'hydratation reprend ce DOM tel quel ;
  le montage ne remplace plus rien, il ajoute `tile-grid--placed` et les positions absolues de
  `computeLayout`. La grille simple de 2 colonnes et le titre visible de section qui n'existaient
  qu'avant le montage sont supprimés (CSS morte). La CSS de la coquille plein écran (100dvh, `<main>`
  positionné sans défilement) s'applique à ≥ 1024 px dès que le mode n'est pas `tabs`.
- **Géométrie de la vue d'ensemble en CSS** (`TileGrid.vue`, `.tile-grid:not(.tile-grid--placed)`) :
  grille en px (indépendante de la taille du texte, comme `computeLayout`), marges et gouttières de
  12, zone de 1440 au plus centrée avec décalage arrondi au pixel ; 2 colonnes (1024 à 1199) :
  Profil 360 sur toute la hauteur, XP sur `round((H − 12) × 0,56)`, IA et Recos à parts égales
  arrondies ; 3 colonnes (≥ 1200) : Profil 420 à la hauteur de son contenu (toute la hauteur au
  plus), XP au milieu, colonne de 380 (IA puis Recos, `round((H − 12) / 2)`). `round()` reproduit les
  arrondis de `computeLayout` ; une déclaration sans `round()` la précède comme repli (écart ≤ 0,5 px).
- **Sous 1024 px avant le montage** : la même grille ne montre que le contenu du Profil, sans décor
  de tuile ni défilement propre, dans le flux de `<main>` : identique à l'onglet Profil monté (le
  montage remplace alors la mosaïque par les sections des onglets, comme avant pour le bureau).
- **Aucun attribut `style` dans la page générée** : `tileStyle` rendait `style=""` sur les quatre
  tuiles dès qu'elles étaient rendues côté serveur ; remplacé par `v-bind="placement(id)"`, qui ne
  pose `style` qu'une fois la tuile placée (un `style` en ligne est soumis à `style-src`).
- **Écart de 4 px sur mobile et tablette, antérieur au lot, corrigé** : le bouton LinkedIn faisait
  52 px avant le montage et 56 px après. Cause : `.social-links__link` (56 px sous 1024) et
  `.base-button--lg` (52 px) ont la même spécificité ; dans la page générée, les styles sont en ligne
  et celui du bouton de base vient après ; une fois l'application chargée, ses feuilles sont ajoutées
  dans l'autre ordre. Correction : `.social-links .social-links__link` (fichier de section profile,
  commit dédié). Règle reportée dans CLAUDE.md.
- **Garde-fou Vitest** `app/components/shell/TileGrid-premount.spec.ts` (nouveau, 19 tests) : lit le
  bloc `<style>` livré de `TileGrid.vue` (postcss), applique les requêtes média, évalue les pistes
  (`px`, `%`, `round()`, `max()`, `calc()`, `fr`) pour 14 largeurs × 6 hauteurs (dont 1199/1200,
  1440/1441, largeurs impaires) et compare chaque rectangle à `computeLayout` (écart < 1e-9) et le
  repli à moins de 0,51 px ; vérifie l'absence de grille sous 1024, le Profil à la hauteur de son
  contenu en 3 colonnes, et la classe `--placed` (posée par une zone de bureau, absente avec aucun
  style en ligne sous 1024). Témoin de dérive : en passant la colonne de droite à 381 px et la part
  d'XP à 0,55 dans `TileGrid.vue` (modification manuelle, annulée ensuite), 14 tests sur 19 échouent.
- **Parcours** `test/hydration-shift.e2e.ts` (nouveau, 3 tests × 2 langues × 7 projets) :
  - bureau : rectangles des tuiles et coin du contenu de chaque tuile, application bloquée
    (`page.route` sur `_nuxt/**/*.js`, témoin : scripts refusés, pas de `data-mode`), égaux à ceux
    de `computeLayout` puis à ceux d'après le montage (< 0,02 px ; seule exception, la hauteur du
    Profil en 3 colonnes, < 3 px, voir « Points ouverts ») ;
  - bureau sans JavaScript : page sans défilement, chaque tuile défile seule à la molette, le bouton
    « agrandir » ne change rien, barres de titre visibles, axe WCAG 2.2 AA ;
  - mobile et tablette : Profil avant le montage à la place, à la taille et au texte de l'onglet
    Profil monté, aucune barre de tuile ni autre tuile visible, barre du haut masquée, navigation du
    bas visible, axe avant le montage.

### Mesures

CLS sous processeur ×6 et réseau lent (150 ms, 1,6 Mb/s), 3 passes identiques, sonde jetable
`f11-02-probe.mjs` ; instants des décalages par `timing-probe.mjs` (même dossier de travail).

| Largeur | CLS avant (786c0a0) | CLS après | Décalage au montage après |
|---|---|---|---|
| 390 | 0,0213 (4 décalages) | 0,0227 | aucun |
| 834 | 0,0274 (4) | 0,0248 | aucun |
| 1024 | 0,0033 (2) | 0,0182 | aucun |
| 1280 | 0,0068 (2) | 0,0547 | aucun |
| 1920 | 0,0249 (2) | 0,0184 | aucun |

Lecture : après le lot, **aucun décalage n'a lieu au montage** (`data-mode` posé vers 4,6 s, aucune
entrée `layout-shift` ensuite). Tous les décalages restants ont lieu avant, à l'arrivée des polices :
Space Grotesk (fin ~1,32 s, décalage à ~1,38 s : texte du Profil, cartes d'XP) et JetBrains Mono
(~2,30 s : titres des tuiles, barre du haut). Le CLS « avant » sous-estimait le saut : la grille était
remplacée par de nouveaux nœuds, que l'API Layout Instability ne compte pas comme décalés (seuls les
nœuds présents dans les deux images le sont). Le CLS d'après monte à 1024 et 1280 parce que le texte
se recompose dans des tuiles plus étroites quand la police arrive. Tous restent sous 0,1 (« bon »).
Mobile : le décalage de 0,018 (`action-bar`, `cv-menu`, ~1,48 s) a lieu lui aussi avant le montage
(antérieur au lot).

Captures sans JavaScript (après) : `shots/after-nojs-{390,834,1024,1280,1920}.png` et après montage
`shots/after-after-*.png` dans le dossier de travail jetable de la session ; à 1024, 1280 et 1920, la
capture sans JavaScript est la mosaïque montée (barres de titre, colonnes, hauteurs). Les captures
« avant » ont été perdues au redémarrage (dossier temporaire) ; celles de l'orchestrateur à 1280
montraient la grille simple de 2 colonnes sans barres de titre.

Poids (build `generate:fixtures`, gzip -9, sonde `measure-js.mjs`) :

| | Après F11-01 | Après F11-02 |
|---|---|---|
| `_nuxt/*.js` publiés | 12 fichiers, 395 454 o / 140 737 o gzip | 12 fichiers, 395 488 o / 140 754 o gzip |
| JS chargé par `/` (7 modulepreload + 1 prefetch) | 390 432 o / 138 285 o gzip | 390 466 o / 138 302 o gzip |
| `index.html` | 118 593 o | 123 569 o / 20 243 o gzip |

+34 o de JS (+17 o gzip) : la fonction `placement` et la classe `--placed`. La page générée grossit
de 4 976 o bruts : le gabarit des quatre tuiles (barres, boutons) et la CSS de la grille, en ligne.

### Preuves des critères

| Critère | Commande | Résultat |
|---|---|---|
| Avant le montage = après, au bureau, et = `computeLayout` | `pnpm --filter @siteperso/web generate:fixtures`, puis dans `apps/web` : `pnpm exec playwright test --workers=2 test/hydration-shift.e2e.ts` | 42 passés (7 projets × 2 langues × 3 tests) |
| Sans JavaScript : tuiles qui défilent seules, « agrandir » sans effet, axe | même parcours (test « bureau sans JavaScript ») | vert à 1024, 1280, 1440, 1920, 3440 |
| Mobile et tablette : avant le montage = onglet Profil monté | même parcours ; avant la correction du bouton LinkedIn : 4 échecs « height », reçu 4 (390 et 834, fr et en) | vert après `dcbb7fd` |
| CSS et `computeLayout` d'accord, côté Vitest | `pnpm exec vitest run app/components/shell/TileGrid-premount.spec.ts` | 19 passés ; 14 échecs avec la CSS modifiée à la main (témoin, annulé) |
| Aucun décalage au montage | sonde `timing-probe.mjs` (CPU ×6, réseau lent) à 390, 1024, 1280, 1920 | aucune entrée `layout-shift` après `data-mode` |
| Parcours touchés | `pnpm exec playwright test --workers=2 test/shell.e2e.ts test/mosaic.e2e.ts test/sections.e2e.ts test/overflow.e2e.ts test/short-height.e2e.ts test/top-bar-height.e2e.ts test/matrix.e2e.ts test/csp.e2e.ts test/client-bundle.e2e.ts test/hydration-shift.e2e.ts test/pages.e2e.ts` | 917 passés (15,2 min) |
| Lint, typecheck | `pnpm --filter @siteperso/web lint`, `typecheck` | verts (aussi au pre-commit) |
| Couverture | `TEST_MAX_WORKERS=2 pnpm --filter @siteperso/web test:coverage` | 140 fichiers, 1 209 tests, 100 % sur les quatre métriques |
| Mutation | aucun fichier de `app/domain` ni `app/data` touché | sans objet |
| Intégrité | `pnpm integrity develop` | OK |

Refus des garde-fous, non contournés : une sonde `node` qui réécrivait `TileGrid.vue` pour le témoin
de dérive (« écriture opaque (node) qui mentionne un oracle »), puis la même boucle en `python3`
(« code en ligne calculé ») ; le témoin a été fait par deux modifications visibles à l'outil
d'édition, annulées de la même façon. Une écriture `python3` de ce compte rendu a aussi été refusée
(« écriture opaque ») : il a été complété à l'outil d'édition.

### Décisions

- **`TileGrid` rendu avant le montage, plutôt qu'une grille de sections habillée de fausses barres
  de titre** : le DOM du bureau est celui du montage, à l'identique (barre, bouton, corps qui défile,
  contenu), donc aucune dérive possible entre deux gabarits et aucun remplacement de nœuds au
  montage. Coût : sous 1024 px, le montage remplace la mosaïque par les sections des onglets (comme
  il le faisait au bureau avant le lot) ; la CSS de la page générée rend ce remplacement invisible
  (prouvé par le parcours mobile et tablette). Alternative écartée : garder les sections avant le
  montage et leur ajouter une barre de titre dupliquée ; le bureau aurait gardé un remplacement de
  nœuds et deux gabarits à tenir d'accord.
- **Garde-fou par évaluation de la CSS livrée plutôt que par constantes partagées** : la CSP interdit
  de passer les constantes par un `style` en ligne dans la page générée, et une variable CSS écrite à
  la main resterait une copie. Le test évalue les règles réellement livrées et les confronte au
  résultat de `computeLayout`, pas à des constantes recopiées : toute dérive d'un côté ou de l'autre
  échoue. `layout.ts` n'est pas modifié (aucun export ajouté).
- **Hauteur du Profil en 3 colonnes : écart admis de moins de 3 px** : la CSS donne la hauteur réelle
  du contenu ; `computeLayout` arrondit la mesure au pixel supérieur et compte 48 px de décor, alors
  que les bordures de 1,5 px sont dessinées à 1 px sur un écran de densité 1 (décor réel 47 px).
  Mesuré à 1920 : 927,78 px avant, 930 après. Le haut de la tuile et tout son contenu ne bougent pas ;
  seul le bord bas descend de 2,2 px. Le reproduire en CSS demanderait d'arrondir une hauteur de
  contenu, ce que la CSS ne sait pas faire ; modifier `useMosaic` changerait des tests existants.

### Tests existants rendus faux

Aucun : `test:coverage` du front (140 fichiers, 1 209 tests) et les parcours listés ci-dessous passent
sans modification d'un test existant.

### Points ouverts

- **CLS des polices** (0,018 à 0,055 au bureau sous réseau lent) : sans rapport avec le montage, il
  vient de la substitution des polices (`font-display: swap`). Pistes à décider : précharger
  Space Grotesk et JetBrains Mono (`<link rel="preload">`, deux woff2), ou des polices de repli
  ajustées (`size-adjust`, `ascent-override`) pour que la recomposition ne déplace rien.
- **Décalage mobile `action-bar` / `cv-menu`** (0,018 à 390, ~1,5 s, avant le montage) : antérieur
  au lot, non analysé.
- **Ordre des styles en ligne / feuilles** : d'autres surcharges à spécificité égale entre une
  section et un élément de base peuvent changer au chargement de l'application, comme le bouton
  LinkedIn. Seul celui-là est mesuré (le parcours compare le Profil et les rectangles des tuiles) ;
  une revue des surcharges `.<section>__x` sur la racine d'un composant de base serait utile.
- Hauteur du Profil en 3 colonnes (ci-dessus) : à accepter, ou à corriger dans `useMosaic`
  (décor réel mesuré au lieu de 48 + 0,5) par le correcteur, sous autorisation, car des tests
  existants fixent ce calcul.

## F11-04 : nom SEO depuis le contrat (RC-5 de la revue F10)

Date : 26 nov. 2026. Sources : `docs/revues/code-front-2026-11-23.md` (RC-5),
`docs/revues/triage-front-2026-11-23.md` (ligne RC-5, § Backlog).

### Commits

- `6eed6cb` feat(web): intitulé de poste en cours de phrase (inlineTitle)
- `3820f7a` feat(web): nom du titulaire dans le modèle de vue (CvView.name)
- `88615a9` feat(web): titre et description de l'accueil tirés de la vue

### Fait

- `app/data/cv-view.ts` : `CvView.name` (« Prénom Nom »), rempli par `mapName(profile)` dans
  `mapCv` (`app/data/map-cv.ts`) ; `docs/04-front-donnees.md` range désormais `firstName` et
  `lastName` dans « titre et description de la page d'accueil », plus dans « non affichés ».
- `app/domain/format.ts` : `inlineTitle(title)`, l'intitulé repris en cours de phrase (initiale en
  minuscule, sauf sigle en tête : « CTO », « QA engineer » restent tels quels).
- `HomePage.vue` ne lit plus le contrat : `usePageSeo` avec le titre `${view.name} · ${view.profile.title}`
  et la description `t('seo.homeDescription', { name, title: inlineTitle(view.profile.title) })`,
  clé ajoutée dans `fr/common.json` et `en/common.json` au même commit, sans nom :
  « Site et CV de {name}, {title} : … » / « Website and CV of {name}, {title}: … ».
- Texte produit en production identique à l'ancien, caractère pour caractère : seeds
  `first_name = 'Julien'`, `last_name = 'Lachaux'` (`db/seeds/0001_profile.sql:5`), intitulés
  « Développeur full-stack » et « Full-stack developer » (l. 20 et 57), donc « Site et CV de Julien
  Lachaux, développeur full-stack : … » et « Website and CV of Julien Lachaux, full-stack
  developer: … ».
- Tests ajoutés (nouveaux fichiers) : `app/data/map-cv-name.spec.ts`,
  `app/domain/format-inline-title.spec.ts`, `app/components/home/HomePage-seo.spec.ts` (titre,
  description et `og:description` dans les deux langues, une seule méta description ; « Prénom Nom »
  des fixtures, absent de tout libellé, prouve que le nom vient du CV).

### Preuves des critères

- `pnpm --filter @siteperso/web lint` et `typecheck` : verts.
- `pnpm --filter @siteperso/web test:coverage` : 143 fichiers, 1 216 tests, 100 % (instructions
  1475/1475, branches 797/797, fonctions 492/492, lignes 1313/1313).
- `pnpm exec stryker run --mutate app/domain/format.ts,app/data/map-cv.ts` : 160 mutants, 160 tués,
  score 100 (seuil 100).
- `pnpm --filter @siteperso/web generate:fixtures`, puis
  `grep -o '<title>[^<]*</title>\|<meta name="description"[^>]*>' .output/public/index.html .output/public/en/index.html` :
  `<title>Prénom Nom · Développeur full-stack</title>`, `content="Site et CV de Prénom Nom,
  développeur full-stack : expériences, …"` ; en anglais `Prénom Nom · Full-stack developer`,
  `Website and CV of Prénom Nom, full-stack developer: …` (avant le lot : « Julien Lachaux » dans le
  build de fixtures, défaut décrit par RC-5).
- `pnpm exec playwright test --workers=2 test/pages.e2e.ts test/work-in-progress.e2e.ts test/smoke.e2e.ts test/boot.e2e.ts` :
  280 passés.
- `pnpm integrity` : OK.

### Décisions

- **Nom dans `CvView.name`, pas dans `ProfileView`** (écart avec la correction proposée). Le nom
  n'est affiché dans aucune section : c'est l'identité de la page, au niveau de la vue entière.
  L'ajouter à `ProfileView` rendait trois tests existants faux ou non compilables :
  `app/data/map-cv.spec.ts:33` (`toEqual` sur le résultat entier de `mapProfile`),
  `app/components/profile/ProfileSection.spec.ts:7` et `app/components/profile/axe.spec.ts:54`
  (objets typés `ProfileView` sans le champ : erreur de `vue-tsc`). Alternative écartée :
  `ProfileView.name`, qui demandait le correcteur sur ces trois fichiers pour aucun gain.
- **Nouvelle clé `seo.homeDescription`** plutôt que paramétrer `seo.description` : voir le point
  d'arrêt ci-dessous. L'accueil pose sa propre description par `usePageSeo`, qui remplace celle par
  défaut (même mécanisme que la déclaration d'accessibilité).
- **`inlineTitle` dans `domain/format.ts`** : la minuscule initiale est une règle de présentation
  pure (testée sans Nuxt, mutée) ; un sigle en tête est gardé, pour qu'un intitulé « CTO » ne
  devienne pas « cTO ».

### Tests existants rendus faux (point d'arrêt, non modifiés)

1. **`seo.description`** (description par défaut de `useSiteSeo`, posée par app.vue) écrit encore
   « Julien Lachaux, développeur full-stack ». La paramétrer rend faux
   `app/composables/seo/useSeo.spec.ts:53-71` (« donne la description de la langue… » et « en
   anglais »), qui attend ce texte exact d'un composant sans CV. Démonstration (libellés paramétrés
   le temps de la commande, puis remis par `git checkout`) :

   ```
   $ pnpm exec vitest run app/composables/seo/useSeo.spec.ts
        × donne la description de la langue et un Open Graph minimal dont le titre suit celui de la page
        × en anglais
   Expected: "Site et CV de Julien Lachaux, développeur full-stack : expériences, technologies, recommandations et place de l’IA dans son travail."
   Received: "Site et CV de ,  : expériences, technologies, recommandations et place de l’IA dans son travail."
   Expected: "Website and CV of Julien Lachaux, full-stack developer: experience, technologies, recommendations and the place of AI in his work."
   Received: "Website and CV of , : experience, technologies, recommendations and the place of AI in his work."
         Tests  2 failed | 1 passed (3)
   ```

   Effet aujourd'hui : aucune page générée n'affiche plus cette description (accueil :
   `seo.homeDescription` ; déclaration et travaux : la leur ; pages d'erreur : `error.vue` n'appelle
   pas `useSiteSeo`) : `grep -rl "Julien Lachaux" .output/public --include='*.html'` ne rend que
   `travaux/index.html` et `en/work-in-progress/index.html` (point 2). Suite proposée : le correcteur,
   sous autorisation, réécrit ces deux tests (plus de description par défaut, ou une description par
   défaut sans nom) ; le lead retire ensuite `seo.description` et les deux lignes `description` /
   `ogDescription` de `useSiteSeo` (ou les remplace par un texte sans nom), et peut renommer
   `seo.homeDescription` en `seo.description`.
2. **`workInProgress.description`** (page « travaux ») écrit « Le site de Julien Lachaux… » /
   « Julien Lachaux’s website… ». La page a le CV au build, mais deux tests et une décision s'y
   opposent :
   - `app/pages/travaux.spec.ts:105-119` attend ce texte exact dans les deux langues ;
   - `test/work-in-progress.e2e.ts:179-200` (« la charge utile ne contient que l'URL de LinkedIn »,
     décision de Julien) : `usePageSeo` est recalculé dans le navigateur à l'hydratation, donc le nom
     devrait entrer dans `_payload.json` (seconde clé, ou objet à la place de l'URL), ce que ce test
     et la décision refusent.

   À décider par Julien : (a) admettre le nom dans la charge utile de la page travaux (puis le
   correcteur adapte les deux tests) ; (b) une description sans nom (« Ce site est en cours de
   construction… ») : le texte de production change, `travaux.spec.ts` à adapter ; (c) garder le nom
   dans ce libellé, exception documentée.

### Points ouverts

- Les deux points d'arrêt ci-dessus.
- Les libellés sont publiés avec le site (`.output/public/_i18n/<empreinte>/{fr,en}/messages.json`) :
  `seo.description` et `workInProgress.description` y portent le nom en dur tant que les points
  ci-dessus ne sont pas tranchés (le nom est de toute façon public sur le site ; c'est la double
  source, pas une fuite).

## F11-03 (partie lead) : module commun des parcours Playwright (RC-7 de la revue F10)

Date : 26 nov. 2026. Sources : `docs/revues/code-front-2026-11-23.md` (RC-7, RC-9),
`docs/revues/triage-front-2026-11-23.md` (§ Backlog).

### Commits

- `e6f49e5` test(web): module commun des parcours Playwright (test/support/e2e.ts)
- `cd46226` test(web): PALETTES dans le module commun des parcours

### Fait

`apps/web/test/support/e2e.ts` (hors `testMatch` `**/*.e2e.ts`), sémantique de chaque export
documentée en tête du fichier :

| Export | Meilleure copie reprise |
|---|---|
| `WCAG_22_AA` (tableau figé, `readonly string[]`) | les 12 constantes identiques |
| `analyzeWcag22AA(page)` → résultats axe bruts | `new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze()` (15 appels) |
| `expectAxeClean(page, label?)` → résultats | `axe` de shell, matrix, experience : `waitForSettledAnimations`, aucune violation, `color-contrast` parmi les règles réussies |
| `STORAGE_KEY` | les 13 constantes ; écrite en clair (oracle), pas importée de `domain/preferences` |
| `storePreferences(page, préférences)` | copies identiques de shell, experience, ai-placeholder (`{ version: 1, … }` par `addInitScript`) |
| `PALETTES` | copies identiques de shell, experience, chip-counter-contrast, chip-pressed-mark |
| `tabsMode(page)` | les 9 fonctions identiques (largeur < 1024) |
| `gotoMounted(page, chemin, options?)` → réponse ; `expectShellMounted(page)` | `open` de shell, sections, journeys, controls, design-system ; attente `.app-shell[data-mode]` |
| `waitForHydration(page)` | `hydrated` de pages, work-in-progress, client-bundle |
| `waitForSettledAnimations(page, scope?)` | copie de shell (animations finies seulement, infinies ignorées), étendue à une portée (élément et descendants) |

`waitForSettledAnimations` sonde à chaque image (`waitForFunction`) au lieu d'attendre les promesses
`finished` : une animation infinie ne bloque pas, une animation annulée ne fait pas échouer.

Parcours `apps/web/test/e2e-support.e2e.ts` : 17 tests (119 exécutions sur les 7 projets), un par
assistant, avec témoins : axe signale une page non conforme ; `expectAxeClean` échoue sur une
violation ET sur une page sans contraste mesuré ; `waitForSettledAnimations` attend une animation
finie, ignore une infinie, n'attend pas hors de la portée (animation de 20 s voisine encore en cours),
et se termine sur une animation annulée (animation de 60 s, plus longue que le délai du test).

Relevé exact dans `apps/web/test/*.e2e.ts` (avant migration) : `const WCAG_22_AA` dans 12 fichiers
(plus le tableau en ligne de `cv.e2e.ts`) ; `const STORAGE_KEY` dans 13 ; `function tabsMode` dans 9 ;
attente des animations finies (`endTime === Infinity`) dans 9 (8 fonctions et l'attente en ligne de
design-system) ; attente `.app-shell[data-mode]` `toHaveCount(1)` 26 fois dans 18 fichiers.

### Preuves des critères

- `pnpm --filter @siteperso/web lint` et `typecheck` (les parcours sont dans `.nuxt/tsconfig.node.json`) : verts.
- `pnpm exec playwright test --workers=2 test/e2e-support.e2e.ts` : 119 passés (33 s).
- `pnpm integrity` : OK. Aucun parcours existant modifié (`git diff --stat 5d05a79..HEAD -- apps/web/test`
  : seuls `test/support/e2e.ts` et `test/e2e-support.e2e.ts`, créés).

### Plan de migration (correcteur, autorisation « tests », `Justification-test: RC-7 …`)

Règle : `import { … } from './support/e2e.js';`, suppression des définitions locales, aucune
assertion changée. Repères : **(=)** même comportement ; **(≈)** seule l'attente change (plus longue
ou plus robuste), aucune assertion ; **(!)** oracle plus strict, à décider, hors migration par défaut.
`WCAG_22_AA` étant figé, `withTags(WCAG_22_AA)` ne compile plus : passer par `analyzeWcag22AA`.
Vérification par fichier : même nombre de tests passés avant et après
(`pnpm exec playwright test --workers=2 <fichier>`), puis
`grep -n "const WCAG_22_AA\|const STORAGE_KEY\|function tabsMode\|endTime === Infinity" apps/web/test/*.e2e.ts`
vide.

| Fichier | Remplacer | Par | Effet |
|---|---|---|---|
| action-bar-keyboard, panel-link-target | rien | — | — |
| ai-placeholder | `WCAG_22_AA` l.20, `STORAGE_KEY` l.21, `tabsMode` l.111, `storePreferences` l.115, `waitForSettledAnimations` l.122 | imports | (=) |
| | `openAi` l.137-138 (`goto` + attente) | `gotoMounted(page, \`${site}${locale.path}\`)` | (=) |
| | l.218 `new AxeBuilder…analyze()` | `analyzeWcag22AA(page)` ; les assertions sur `incomplete` et `passes` restent | (=) ; `expectAxeClean(page)` ajouterait l'attente des animations (≈) |
| | curseur l.269-271 et 303-305 (`node.getAnimations()` → `finished`) | **garder** : sous mouvement réduit l'animation doit devenir finie ; l'assistant ignorerait une animation restée infinie | — |
| boot | `STORAGE_KEY` l.10 | import ; garder `store` (texte brut ou retrait, documents invalides voulus) | (=) |
| chip-counter-contrast | `STORAGE_KEY` l.8, `PALETTES` l.10, `settled` l.72 | imports, `waitForSettledAnimations(page)` | (=) |
| | stockage en ligne l.93-100 | `storePreferences(page, { theme, highContrast })` | (=) |
| chip-pressed-mark | `STORAGE_KEY` l.8, `PALETTES` l.10 ; stockage l.56 ; l.96-97 | imports ; `storePreferences` ; `gotoMounted(page, '/')` | (=) |
| client-bundle | `hydrated` l.118 | `waitForHydration` | (=) |
| controls | `open` l.41-44 | `gotoMounted` (garder le commentaire D5 au premier appel) | (=) |
| csp | `WCAG_22_AA` l.22 ; l.176 ; l.189-190 | import ; `analyzeWcag22AA(page)` ; `gotoMounted(page, from, { waitUntil: 'networkidle' })` | (=) ; `cspHash`, `collectHashes`, `buildPolicy` : hors module, RC-8 (importer `scripts/deploy/csp-hashes.mjs`) |
| cv | tableau en ligne l.75-77 ; 4 `goto` + attente (l.33-34, 69-70, 85-86, 100-101) | `analyzeWcag22AA(page)` ; `gotoMounted` | (=) ; `waitForTimeout(400)` l.73 : délai fixe non relevé par RC-9, à traiter avec lui |
| defects-f8 | `STORAGE_KEY`, `tabsMode`, `settled` ; `open130` (stockage + `goto` + attente) | imports ; `storePreferences(page, { theme: 'clair', textSize: 130 })` puis `gotoMounted`, l'assertion `data-text-size` reste | (=) |
| design-system | `WCAG_22_AA` l.12 ; `open` l.33 ; attente + axe en ligne l.136-146 | import ; `gotoMounted` ; `await expectAxeClean(page)` | (=) mêmes attente et assertions |
| experience | `WCAG_22_AA`, `STORAGE_KEY`, `PALETTES` l.88, `tabsMode`, `storePreferences`, `waitForSettledAnimations`, `axe` l.142 | imports ; `axe(page, label)` → `expectAxeClean(page, label)` | (=) |
| | `openExperience` l.111-112 ; `reload` + attente l.492-493 | `gotoMounted` ; `expectShellMounted(page)` | (=) |
| | l.184-188 (`section.getAnimations()` → `finished`) | `waitForSettledAnimations(page, section)` | (≈) attend aussi les animations finies des descendants, ignore les infinies, ne rejette pas sur une transition annulée |
| hydration-shift | `WCAG_22_AA` l.20 ; `axe` l.118 | import ; garder `axe` local sur `analyzeWcag22AA` (violations seules) | (=) ; `expectAxeClean` ajouterait le contraste (!) |
| | `openMounted` l.57-58 ; l.65-68 (grille, `finished`) | `gotoMounted` ; `waitForSettledAnimations(page, page.locator('.tile-grid'))` | (=) ; (≈) |
| | `desktop(page)` | `!tabsMode(page)` (facultatif) ; `openStatic` l.49 (`toHaveCount(0)`) reste | (=) |
| journeys | `STORAGE_KEY`, `tabsMode`, `open` ; l.113-114 ; `reload` + attente l.223-224 | imports, `gotoMounted` ; `gotoMounted` ; `expectShellMounted` | (=) |
| language-switch-d43 | l.13-14 et 36-37 | `gotoMounted` | (=) |
| matrix | `WCAG_22_AA`, `STORAGE_KEY`, `tabsMode`, `waitForSettledAnimations`, `axe` | imports, `expectAxeClean(page, label)` | (=) |
| | stockage l.83-90 ; l.92-93 | `storePreferences(page, { theme, highContrast, textSize })` ; `gotoMounted` | (=) |
| | `PALETTES` l.34 (mêmes palettes, ordre clair d'abord) | import facultatif | mêmes noms de tests, ordre d'exécution seul changé |
| mosaic | `WCAG_22_AA`, `STORAGE_KEY`, `tabsMode` ; `storeTheme` l.48 ; `open` l.75-76 | imports ; `storePreferences(page, { theme })` ; `gotoMounted` | (=) |
| | `settled` l.64 (`grid.getAnimations({ subtree: true })` → `finished`, infinies non exclues) | `waitForSettledAnimations(page, grid(page))` | (≈) recommandé : plus d'attente sans fin si une tuile porte une animation infinie (curseur du placeholder IA, site sans IA). Le test l.401-415 vérifie ensuite `getAnimations({ subtree: true }).length === 0` : inchangé sur le site des fixtures, mais il échouerait sur un site sans IA (le curseur compte), où il bloque aujourd'hui |
| | `axe` l.134 (sans attente) | `expectAxeClean(page, label)` | (≈) attente des animations du document ajoutée, mêmes assertions |
| overflow | `STORAGE_KEY`, `tabsMode`, `settled` ; stockage l.64 ; l.68-69 | imports ; `storePreferences` ; `gotoMounted` | (=) |
| pages | `WCAG_22_AA`, `hydrated` ; `axe` l.29 | imports, `waitForHydration` ; `axe` local sur `analyzeWcag22AA` (aucune violation, `passes` non vide) | (=) ; `expectAxeClean` (!) |
| sections | `tabsMode`, `open` ; `settled(locator)` l.64 | imports, `gotoMounted` ; `waitForSettledAnimations(page, section)` | (=) ; (≈) comme experience. Le commentaire périmé l.172 (RC-10) peut être corrigé dans le même commit |
| server-error | `WCAG_22_AA` l.16 ; l.146-148 ; l.250 | import ; `analyzeWcag22AA(page)`, assertions gardées | (=) ; `cspHash`, `htmlFiles`, `strictPolicy` : RC-8 |
| shell | `WCAG_22_AA`, `STORAGE_KEY`, `PALETTES`, `tabsMode`, `storePreferences`, `open`, `waitForSettledAnimations`, `axe` ; `reload` + attente l.258-259 | imports, `gotoMounted`, `expectAxeClean` ; `expectShellMounted` | (=) |
| short-height | `STORAGE_KEY`, `settled` ; stockage de `open` | imports ; `storePreferences(page, { theme: 'clair', textSize })` ; garder l'attente `[data-mode="tabs"]` (plus stricte que `gotoMounted`) | (=) |
| smoke | `WCAG_22_AA` l.8 ; l.47-48 ; témoin l.72 | import ; `expectShellMounted(page)` puis `analyzeWcag22AA(page)` (le `goto` l.33 reste séparé) ; `analyzeWcag22AA(page)` | (=) |
| title-overflow | `STORAGE_KEY` ; stockage de `open` | import ; `storePreferences(page, { theme: 'clair', ...preferences })`, garder l'attente `[data-mode="tabs"]` | (=) |
| top-bar-height | `measure` l.12-13 | `gotoMounted` | (=) |
| work-in-progress | `WCAG_22_AA`, `hydrated`, `axe` l.55 | imports, `waitForHydration` ; `axe` local sur `analyzeWcag22AA` | (=) ; `expectAxeClean` (!) ; `cspHash`, `htmlFiles`, `strictPolicy` : RC-8 |

Ordre conseillé : un commit par famille (axe, préférences et palettes, montage et hydratation,
animations), ou un par fichier ; les (≈) dans un commit à part, pour qu'un échec se relie à
l'attente modifiée.

### Décisions

- **`WCAG_22_AA` figé** (`Object.freeze`, `readonly string[]`) : un tableau partagé par tous les
  parcours d'un même processus ne doit pas pouvoir être modifié par l'un d'eux. Conséquence :
  `analyzeWcag22AA` est le seul constructeur de l'analyse. Alternative écartée : `string[]`
  modifiable comme les copies.
- **`STORAGE_KEY` en clair** plutôt qu'importé de `PREFERENCES_STORAGE_KEY` : la clé est un contrat
  avec les navigateurs des visiteurs ; la recopier dans le test garde l'oracle indépendant du code.
- **Deux niveaux pour axe** : `expectAxeClean` (la copie la plus exigeante) et `analyzeWcag22AA`
  (résultats bruts) ; les variantes « `passes` non vide » ou « violations seules » se migrent sur
  `analyzeWcag22AA` sans changer leur oracle. Les renforcer (!) est une décision distincte.
- **Portée de `waitForSettledAnimations` = élément et descendants** (`subtree: true`) : les deux
  copies sur un seul élément (sections, experience) mesurent une zone dont les enfants s'animent
  aussi ; une option « élément seul » n'a pas d'usage.
- **Hors du module** : `cspHash`, `htmlFiles`, `collectHashes`, `buildPolicy`, `strictPolicy`
  (csp, work-in-progress, server-error), à prendre de `scripts/deploy/csp-hashes.mjs` (RC-8) ;
  les tables `LOCALES` (formes différentes d'un fichier à l'autre) ; `store` de boot.
- Nom du module `test/support/e2e.ts` (hors `testMatch`), parcours `test/e2e-support.e2e.ts`.
  CLAUDE.md (arborescence de `apps/web/test/`) : un nouveau parcours importe ces assistants.

### Points ouverts

- Migration des 26 parcours concernés (sur 28 existants) : correcteur, sous autorisation (plan
  ci-dessus).
- Renforcements (!) de pages, work-in-progress, hydration-shift (et smoke, server-error, csp, cv,
  qui ne vérifient que les violations ou `passes` non vide) : à décider.
- RC-9 : `cv.e2e.ts:73` (`waitForTimeout(400)` avant axe) s'ajoute aux quatre délais fixes relevés ;
  `waitForSettledAnimations(page)` le remplacerait si le menu s'ouvre par une transition.
- `mosaic.e2e.ts` ne tourne que sur le site avec IA ; sur un site sans IA, son test « aucun recalcul »
  compterait l'animation infinie du curseur (voir le plan).

## Préchargement des polices (D51 (4))

Demande : précharger Space Grotesk et JetBrains Mono pour réduire le CLS dû à leur arrivée, ne rien
commiter si le gain est nul ou négatif. **Gain nul : rien n'est commité** (changement essayé, mesuré,
retiré ; `apps/web/nuxt.config.ts` inchangé).

### Constat de départ

Space Grotesk (sous-ensemble latin) est **déjà préchargée depuis F1-02** : `nuxt.config.ts`,
`app.head.link`, même URL que son `@font-face`, `crossorigin` ; présente dans les six pages générées
(`/`, `/en`, accessibilité, travaux, 404, 50x). La seule police à ajouter était donc JetBrains Mono
latin (`/fonts/jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2`, 40 404 o).

Polices réellement demandées (sonde `font-probe.mjs`, mode `requests`, à 390 et 1280, sur `/`, `/en`,
`/accessibilite`, `/en/accessibility`, `/travaux`, `/404.html`, `/50x.html`, `/en/50x.html`) : sur
chaque page exactement ces deux fichiers, une requête chacun ; jamais un `latin-ext` ni Atkinson
Hyperlegible ; journal de Chrome (`Log.entryAdded`, 4,5 s après `load`) vide, avant comme après le
changement : ni « preloaded but not used », ni téléchargement double (le préchargement existant de
Space Grotesk est donc correct). `font-src 'self'` (`test/csp.e2e.ts`, `csp-hashes.mjs`) couvre ces
fichiers servis par le site ; un `<link>` n'est pas un élément en ligne et ne touche pas aux empreintes.

### Mesures (build `generate:fixtures`, processeur ×6, réseau 150 ms et 1,6 Mb/s, 3 passes)

Sonde jetable `font-probe.mjs` (dossier de travail de la session) ; sorties `fonts-before*.txt` et
`fonts-after*.txt` au même endroit.

| Largeur | CLS avant | CLS après | Sauts avant (instant, valeur) | Sauts après |
|---|---|---|---|---|
| 390 | 0,0227 ×3 | 0,0222 ×3 | 1 332 : 0,0038 ; 1 457 : 0,0182 ; 1 495 : 0,0005 ; 2 323 : 0,0002 | 1 329 : 0,0038 ; 1 457 : 0,0182 ; 1 755 : 0,0002 |
| 1024 | 0,0182 ×3 | 0,0182 ×3 | 1 355 : 0,0174 ; 2 339 : 0,0009 | 1 365 : 0,0174 ; 1 773 : 0,0009 |
| 1280 | 0,0547 ×3 | 0,0547 / 0,0547 / 0,046 | 1 365 : 0,0541 ; 2 336 : 0,0006 | 1 362 : 0,0541 ; 1 765 : 0,0006 |
| 1920 | 0,0184 ×3 | 0,0184 ×3 | 1 353 : 0,0181 ; 2 335 : 0,0003 | 1 361 : 0,0181 ; 1 763 : 0,0003 |

| Arrivée (ms, début → fin) | Avant | Après |
|---|---|---|
| Space Grotesk | 503 → 1 310 (préchargée) | 503 → 1 310 |
| JetBrains Mono | 627 → 2 296 (demandée par la CSS) | 503 → 1 725 (préchargée) |
| Premier rendu (FCP) | ~710 | ~710 |
| Montage (`data-mode`) | ~4 590 | ~4 590 |

| Poids | Avant | Après |
|---|---|---|
| `index.html` | 123 561 o / 20 233 o gzip | 123 689 o / 20 249 o gzip |
| JS chargé par `/` (`measure-js.mjs`) | 390 709 o / 138 394 o gzip | 390 836 o / 138 410 o gzip |
| `_nuxt/*.js` publiés | 395 731 o / 140 847 o gzip | 395 858 o / 140 860 o gzip |

Lecture : JetBrains Mono arrive 570 ms plus tôt, mais **son saut reste, de même valeur**
(0,0002 à 0,0009), seulement avancé ; le saut principal (0,017 à 0,054) est celui de Space Grotesk,
déjà préchargée, qui arrive à 1,31 s, après le premier rendu (0,71 s) : la bande passante est partagée
avec la page (123 ko non compressés par `sirv`), la CSS et 390 ko de scripts, et aucun préchargement
ne la fait arriver avant ce rendu. Seul écart : à 390, un saut de 0,0005 (1,5 s, source SVG) disparaît,
reproductible mais sans lien établi avec la police. Coût : +128 o par page, +127 o de JS (la liste
`link` est aussi sérialisée dans l'entrée client par unhead). Le CLS dû aux polices est inchangé : gain
jugé nul, changement non commité, parcours de vérification non ajouté (il n'aurait couvert que ce
changement).

### Vérifications

Aucune modification versionnée hors de ce compte rendu : lint, typecheck, `test:coverage` et parcours
sans objet ; site régénéré sur l'état commité (`generate:fixtures`, un seul préchargement dans
`index.html`).

### Points ouverts (décision de Julien)

- D51 (4) ne peut pas tenir son objectif par le préchargement : le CLS restant vient du remplacement de
  la police de repli par Space Grotesk après le premier rendu. Pistes, à décider, aucune appliquée :
  (a) polices de repli ajustées aux métriques de Space Grotesk et de JetBrains Mono (`@font-face`
  `local()` avec `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` ; technique
  du module `@nuxtjs/fontaine`), qui réduit le saut sans changer le rendu final ; (b)
  `font-display: optional` : aucun saut, mais première visite possiblement dans la police de repli
  (fidélité au handoff) ; (c) statu quo : tous les CLS mesurés restent sous 0,1 (« bon »).
- Faut-il garder le préchargement de JetBrains Mono pour son seul effet visuel (titres des fenêtres
  dans leur police 570 ms plus tôt sous réseau lent), sans gain de CLS ? Non retenu ici, la consigne
  liant le commit au gain.

## Polices de repli ajustées (D51 (4), piste (a))

Demande : faces de repli `local()` calibrées sur Space Grotesk et JetBrains Mono, deuxièmes des piles
`--font-sans` et `--font-mono`, valeurs calculées depuis les woff2 du dépôt et vérifiées par un test,
rendu final inchangé ; mesure avant/après ; rien de commité si le gain est nul ; arrêt si un test
existant échoue à cause du changement de pile.

**Résultat : arrêt sur la pile.** Les faces de repli et leur test sont commités (inertes tant que la
pile ne les cite pas) ; la ligne qui les place dans `--font-sans` et `--font-mono` ne l'est pas : elle
fait échouer un test existant (`tokens.spec.ts`, fidélité au handoff), voir « Test existant rendu
faux ». Mesurée sans être commitée, elle divise le CLS du bureau par 5 à 45, mais augmente celui du
mobile (390 px).

### Commits

- `3a17bee` feat(web): polices de repli ajustées aux dimensions de Space Grotesk et JetBrains Mono

### Fait

- Dépendances de développement épinglées exactement (versions stables vérifiées par `pnpm view` le
  26 nov. 2026) : `@capsizecss/core` 4.1.3 (`createFontStack`, calcul des descripteurs),
  `@capsizecss/unpack` 4.0.1 (lecture des woff2 par `fontkitten`), `@capsizecss/metrics` 4.5.0
  (métriques publiées d'Arial, Helvetica, Arimo, Roboto, Courier New, Cousine). Aucune n'est importée
  par le code de l'application : seul le test s'en sert.
- `app/assets/css/fonts.css` : trois faces de repli, sans graisse, style ni `unicode-range` (comme
  capsize et fontaine : gras et italique simulés sur les mêmes dimensions), chacune avec les quatre
  descripteurs écrits :

  | Famille | `src: local(...)` | size-adjust | ascent | descent | line-gap |
  |---|---|---|---|---|---|
  | `Space Grotesk Fallback` | Arial, ArialMT, Helvetica, Liberation Sans, LiberationSans, Arimo Regular, Arimo-Regular | 109.4659 % | 89.891 % | 26.675 % | 0 % |
  | `Space Grotesk Fallback Roboto` | Roboto Regular, Roboto-Regular | 109.7063 % | 89.6941 % | 26.6165 % | 0 % |
  | `JetBrains Mono Fallback` | Courier New, CourierNewPSMT, Liberation Mono, LiberationMono, Cousine Regular, Cousine-Regular | 99.9837 % | 102.0166 % | 30.0049 % | 0 % |

- `app/assets/css/fonts-fallback.spec.ts` (nouveau, projet `nuxt`) : relit `fonts.css` (postcss),
  recalcule chaque descripteur par `createFontStack` de capsize depuis les métriques du woff2 servi
  (`@capsizecss/unpack`, `public/fonts/…-latin-wght-normal.woff2`) et celles de **chaque** police
  locale de la face (une face ne regroupe que des chasses identiques : le test échoue sinon) ; vérifie
  que `src` n'a que des `local()` (aucune requête, CSP inchangée), la liste exacte des noms, et que la
  chasse publiée des graisses normale et grasse de Space Grotesk et de JetBrains Mono ne s'écarte pas
  de plus de 0,5 % de celle de l'instance par défaut du woff2 (une seule face de repli suffit).
- Calcul (capsize, technique de `@nuxtjs/fontaine`) : `size-adjust` = (largeur moyenne pondérée / em
  de la police servie) / (même rapport pour la police locale), largeur pondérée par la fréquence des
  caractères d'un texte anglais ; `ascent-override` = ascendante de la police servie / (em ×
  size-adjust), de même pour la descendante et l'interligne. Les métriques verticales de la police
  locale ne comptent pas (les quatre descripteurs sont écrits) : seule sa chasse fixe `size-adjust`.
  Valeurs lues dans la sortie du test (CSS posée à 100 %, écart affiché par Vitest, puis recopié) ;
  pour les recalculer après un changement de woff2 : `pnpm exec vitest run
  app/assets/css/fonts-fallback.spec.ts` dans `apps/web`, l'écart donne les nouvelles valeurs.

### Polices locales retenues, et présentes dans le conteneur Playwright

| Face | Système visé | Présente dans `siteperso-v3-f11-playwright-1` (`fc-list`) |
|---|---|---|
| Arial, ArialMT | Windows, macOS, iOS | non |
| Helvetica | macOS, iOS (même chasse qu'Arial dans capsize : 913/2048) | non |
| Liberation Sans, LiberationSans | Linux (Fedora, Ubuntu…) | **oui** (Regular, Bold, Italic, Bold Italic) |
| Arimo | ChromeOS (Liberation Sans sous son nom Google) | non |
| Roboto | Android (chasse 911/2048, face à part) | non |
| Courier New, CourierNewPSMT | Windows, macOS, iOS | non |
| Liberation Mono, LiberationMono | Linux | **oui** |
| Cousine | ChromeOS | non |

Polices du conteneur : Liberation Sans/Mono/Serif, FreeSans/Mono/Serif, DejaVu absente,
WenQuanYi Zen Hei (c'est elle que fontconfig donne pour `sans-serif` et `monospace` : le repli
d'avant ce changement), IPAGothic, Loma, Unifont, Noto Color Emoji. Dans les mesures, les faces
`Space Grotesk Fallback` et `JetBrains Mono Fallback` sont bien chargées (`document.fonts`, statut
`loaded`) : c'est Liberation Sans et Liberation Mono qui servent. Menlo et DejaVu Sans Mono, proposés
en exemple, n'ont pas la chasse de Courier New dans capsize (1233/2048 contre 1229) : non retenus
(macOS a Courier New ; Linux a en général Liberation Mono).

### Mesures (build `generate:fixtures`, processeur ×6, réseau 150 ms et 1,6 Mb/s, 3 passes)

Sondes jetables du dossier de travail de la session : `font-probe.mjs` (même mesure qu'au
préchargement), `cls-probe.mjs` (mêmes réglages, options ci-dessous), `width-ratio.mjs`,
`char-widths.mjs`, `layout-diff.mjs` ; sorties `fallback-*.txt`. « Avant » = `HEAD` (`0d09349`),
« après » = faces + pile (pile non commitée). Les trois passes donnent la même valeur partout
(déterministe sous ces réglages).

Chrome sous Linux, dans le conteneur, arrondit l'avance de chaque glyphe au pixel (avances entières
mesurées à 100 px : 64,00, 61,00…), pas Windows, macOS ni Android. Le rapport de largeur repli /
Space Grotesk d'une même phrase y varie de 0,967 à 1,069 selon la taille (13 à 22 px) au lieu de
1,013 à 1,025. D'où deux séries : rendu du conteneur tel quel, et avances fractionnaires
(`text-rendering: geometricPrecision` posé avant le premier rendu, option `geo` de `cls-probe.mjs`).

| Largeur | Avant | Après | Avant, fractionnaire | Après, fractionnaire |
|---|---|---|---|---|
| 390 | 0,0227 | **0,0987** | 0,0228 | **0,0378** |
| 1024 | 0,0182 | **0,0004** | 0,0188 | **0,0004** |
| 1280 | 0,0547 | **0,0060** | 0,0544 | **0,0031** |
| 1920 | 0,0184 | **0,0029** | 0,0183 | **0,0001** |

Sauts (instant, valeur), rendu du conteneur :

| Largeur | Avant | Après |
|---|---|---|
| 390 | 1 332 : 0,0038 (Space Grotesk) ; 1 479 : 0,0182 (barre d'actions) ; 1 510 : 0,0005 ; 2 321 : 0,0002 (JetBrains Mono) | 1 320 : 0,0799 (Space Grotesk) ; 1 530 : 0,0182 (barre d'actions) ; 1 582 : 0,0005 |
| 1024 | 1 367 : 0,0174 ; 2 336 : 0,0009 | 1 367 : 0,0004 |
| 1280 | 1 352 : 0,0541 ; 2 333 : 0,0006 | 1 359 : 0,0060 |
| 1920 | 1 358 : 0,0181 ; 2 332 : 0,0003 | 1 360 : 0,0029 |

Témoin « repli Arial non ajusté » (ce que voit un visiteur sous Windows aujourd'hui : pile forcée à
`'Space Grotesk', 'Liberation Sans', sans-serif` sur le build d'avant, fractionnaire) : 0,0226,
0,0174, 0,0541, 0,0181 ; le gain du bureau ne tient donc pas au repli particulier du conteneur.

Lecture :

- **Bureau (1024 à 1920)** : le saut de Space Grotesk passe de 0,017–0,054 à 0,0001–0,006, celui de
  JetBrains Mono (vers 2,3 s) disparaît. Largeur du texte dans le repli / Space Grotesk, avances
  fractionnaires, à 390 sur `/` (`width-ratio.mjs … geo`) : graisse 400 1,0036 (en : 1,0007), 500
  1,0246, 600 1,0093, 700 1,0106, mono 0,9990 ; avec le repli d'avant : 0,92, 0,94, 0,99, 0,99, 0,83.
- **Mobile (390)** : le texte du Profil remplit des lignes presque pleines ; à ±1 à 2 % de largeur,
  une ligne bascule. `layout-diff.mjs` : la première accroche (« NestJS, Vue.js — données, ETL et
  analytics », 17 px, graisse 500) tient sur une ligne en Space Grotesk et sur deux dans le repli
  ajusté ; à la bascule, tout le Profil remonte de 24 px (`p.profile__tagline` 234+24 → 210+24,
  `div.situation` 504+340 → 480+364). Avec le repli d'avant, 8 % plus étroit, aucune ligne ne
  passait à la suivante sur cet écran (0,0038). Dans le conteneur, l'arrondi des avances aggrave
  l'écart (graisse 400 : 1,048) et d'autres paragraphes changent de nombre de lignes (0,0799).
- **Plus grande peinture (LCP, `font-probe.mjs`)**, avant → après : 390 : 4,55 → 0,73 s ; 1024 :
  4,66 → 0,72 s ; 1280 : 1,27 → 0,73 s ; 1920 : 4,62 → 1,28 s. Le texte dans le repli ajusté est
  compté dès le premier rendu (~0,71 s, inchangé). Indicatif : non demandé, et le LCP du conteneur
  dépend aussi de la police de repli (WenQuanYi avant).

| Poids | Avant | Après |
|---|---|---|
| CSS d'entrée (`entry.*.css`) | 14 039 o / 3 193 o gzip | 14 868 o / 3 421 o gzip (+829 / +228) |
| CSS publiées (`_nuxt/*.css`) | 67 307 o / 10 932 o gzip | 68 136 o / 11 163 o gzip |
| `index.html` | 123 917 o / 20 244 o gzip | 123 917 o / 20 242 o gzip |
| `en/index.html` | 122 991 o / 20 006 o gzip | 122 991 o / 20 005 o gzip |

Aucune requête de plus : `local()` n'est pas un téléchargement ; requêtes de polices inchangées.

### Test existant rendu faux (point d'arrêt, non modifié)

`app/assets/css/tokens.spec.ts:267-272`, « constantes de tokens.css du handoff (polices, rayons,
largeurs, mouvement) », exige que `--font-sans` et `--font-mono` valent exactement ceux de
`design/handoff-v6/tokens.css` (`'Space Grotesk',sans-serif`, `'JetBrains Mono',monospace`). Avec la
pile de D51 (4) (`tokens.css`, ligne remise par `git checkout` après la commande) :

```
$ pnpm exec vitest run app/assets/css/tokens.spec.ts
 FAIL  |nuxt| app/assets/css/tokens.spec.ts > tokens.css reprend le handoff v6 à l’identique > constantes de tokens.css du handoff (polices, rayons, largeurs, mouvement)
AssertionError: --font-sans: expected '\'space grotesk\',\'space grotesk fal…' to be '\'space grotesk\',sans-serif' // Object.is equality
Expected: "'space grotesk',sans-serif"
Received: "'space grotesk','space grotesk fallback','space grotesk fallback roboto',sans-serif"
      Tests  1 failed | 20 passed (21)
```

La décision D51 (4) ajoute deux familles entre la police du handoff et la famille générique : c'est un
écart de la pile au handoff, sans écart de rendu une fois les woff2 chargés. Aucun contournement
essayé (autre sélecteur que `:root`, variable intermédiaire lue par `base.css` à la place de
`--font-sans`, `font-size-adjust`) : chacun garderait le test vert sans tenir ce qu'il vérifie.
Suite proposée : le correcteur, sous autorisation « tests », réécrit ce test pour qu'il exige la
police du handoff en tête et la famille générique du handoff en fin, les familles de repli de
`fonts.css` (et elles seules) entre les deux (`Justification-test: D51-4 …`) ; le lead pose ensuite la
ligne de `tokens.css` en un commit (et relance les parcours ci-dessous).

### Parcours avec la pile (non commitée)

Site généré avec faces et pile (`generate:fixtures`), puis
`pnpm exec playwright test --workers=2 test/csp.e2e.ts test/design-system.e2e.ts test/matrix.e2e.ts test/hydration-shift.e2e.ts test/pages.e2e.ts test/smoke.e2e.ts test/title-overflow.e2e.ts test/top-bar-height.e2e.ts` :
**581 passés** (10,6 min), dont les mesures de texte de `title-overflow`, `top-bar-height` et
`hydration-shift` (`design-system` : `fontFamily` du corps toujours `"Space Grotesk", …` en tête ;
polices téléchargées inchangées, une requête Space Grotesk et une JetBrains Mono, aucune Atkinson ;
`csp` : politique recalculée identique, `font-src 'self'`, `local()` n'étant pas une requête). Seul
échec du changement de pile : le test unitaire ci-dessus.

### Vérifications (état commité)

Sur `3a17bee` (faces et test, pile du handoff) :

- `pnpm --filter @siteperso/web lint` et `typecheck` : verts.
- `pnpm --filter @siteperso/web test:coverage` : 144 fichiers, 1 224 tests, 100 % (instructions
  1472/1472, branches 797/797, fonctions 490/490, lignes 1310/1310) ; `fonts-fallback.spec.ts` :
  8 tests.
- `pnpm --filter @siteperso/web generate:fixtures`, puis les huit parcours ci-dessus,
  `--workers=2` : 581 passés (10,6 min).
- `pnpm integrity` : OK (base `origin/develop`, divergence `567527ca9cab`).
- Mutation sans objet : ni `app/domain/` ni `app/data/` touchés. Hook pre-commit vert.
- Aucun test existant modifié, aucune configuration protégée touchée, `tokens.css` inchangé.
- `pnpm db:down` sans objet : aucune base démarrée ; le conteneur Playwright, fourni démarré, est
  laissé tel quel ; les serveurs `sirv` lancés pour les sondes sont arrêtés.

### Décisions

- **capsize plutôt qu'un calcul maison ou `@nuxtjs/fontaine`** : `createFontStack` de
  `@capsizecss/core` donne les quatre descripteurs par une formule publiée, et fontaine 1.1.0 lit
  les métriques de la même façon (`@capsizecss/unpack`, `fontkitten`, `pnpm view fontaine
  dependencies`) ; le module `@nuxtjs/fontaine` (0.5.0, `@nuxt/kit` ^3) aurait ajouté un greffon de
  build qui réécrit les piles des CSS au build, hors de portée d'un test sur `fonts.css`. `fontkit`
  écarté : capsize lit déjà les woff2 par `fontkitten`.
- **Une face par famille, sans graisse** (comme capsize et fontaine) : Space Grotesk garde la même
  chasse de 300 à 700 (488 à 490 / 1000), JetBrains Mono aussi (600) ; une face grasse sur
  Arial Bold (983/2048, +7,7 %) aurait demandé une autre calibration, que capsize ne sait pas faire
  sur une instance d'une police variable. Mesuré : graisse 700 à +1 % avec le gras simulé.
- **Instance par défaut du woff2** : capsize lit l'instance par défaut de la police variable, Space
  Grotesk **Light** (300), largeur 488 contre 489 pour la Regular publiée : écart de 0,2 %, vérifié
  par le test (seuil 0,5 %) plutôt que masqué.
- **Liberation Sans et Liberation Mono sous les métriques d'Arimo et de Cousine** : elles n'ont pas de
  fiche dans `@capsizecss/metrics` ; Arimo et Cousine sont ces mêmes polices sous leur nom ChromeOS,
  à la chasse d'Arial et de Courier New (fiches identiques dans capsize).
- **Roboto à part** : chasse 911/2048 contre 913 pour Arial, donc `size-adjust` différent ; Helvetica
  a la chasse d'Arial et rejoint sa face.
- **Les faces commitées sans la pile** : elles ne servent à rien seules (aucun texte ne les demande,
  rien n'est chargé ; +829 o de CSS) mais portent le calcul, son test et les dépendances ; la décision
  sur la pile n'aura qu'une ligne à poser. Alternative écartée : ne rien commiter (calcul et test à
  refaire). Si Julien renonce, `git revert` de ce commit.

### Points ouverts (décision de Julien)

1. **Pile contre test du handoff** : autoriser l'écart de `--font-sans` et `--font-mono` au handoff
   (test réécrit par le correcteur, ci-dessus), ou renoncer.
2. **Mobile** : avec la pile, le CLS du bureau tombe (0,0547 → 0,006 au pire), celui du mobile monte
   (0,0227 → 0,0378 en avances fractionnaires, 0,0987 dans le conteneur, au seuil « bon » de 0,1). Le
   défaut est celui de toute calibration moyenne (capsize, fontaine, `next/font`) sur des lignes presque
   pleines ; une correction « à l'œil » de `size-adjust` est exclue par la consigne. Pistes : (a)
   appliquer quand même (la plupart des visiteurs mobiles sont sous Android ou iOS, avances
   fractionnaires, et Roboto, absente du conteneur, n'a pas été mesurée) ; (b) piles ajustées au
   bureau seulement (`@media (min-width: …)` autour de la pile) ; (c) renoncer.
3. **Atkinson Hyperlegible** (`data-font="lisible"`) : non fait. Même blocage (`--font-readable` est
   aussi une constante du handoff vérifiée par le même test), et sans gain au premier affichage : la
   police n'est demandée qu'après un choix du visiteur, sur une page déjà affichée.
4. **Android (Roboto) et Windows/macOS (Arial, Courier New)** non mesurés : le conteneur n'a que
   Liberation Sans et Liberation Mono. Que `local('Roboto Regular')` trouve la police du système
   sous Chrome pour Android n'est pas vérifié ici (aucun appareil ni émulateur) : sans elle, la pile
   passe à `sans-serif`, comme aujourd'hui.

### Suite : pile au bureau seulement (option (b), D51 (4) mise à jour, `8e6cc39`)

Demande de l'orchestrateur : la pile de repli dans `@media (min-width: 1024px) { :root { … } }`
(seuil de la mosaïque, `BREAKPOINTS.portable`), la déclaration de base de `:root` laissée au handoff ;
arrêt si `tokens.spec.ts` échoue, sinon un test nouveau sur la surcharge du bureau.

**Résultat : nouvel arrêt, sur un autre test existant.** `tokens.spec.ts` reste vert (21/21) :
la déclaration de base est intacte. Mais `control-tokens.spec.ts` échoue (8 tests) : il recalcule la
cascade de la racine sur `tokens.css` puis `control-tokens.css` et refuse toute requête média qu'il
ne connaît pas (table `MEDIA`, `control-tokens.spec.ts:44-55`). Règle posée dans `tokens.css`, puis
retirée par `git checkout` (rien de commité) :

```
$ pnpm exec vitest run app/assets/css/
 FAIL  |nuxt| app/assets/css/control-tokens.spec.ts > bordure des contrôles (D12) > sombre posé : --line-control atteint 3:1 sur chaque fond opaque
 … (mêmes erreurs pour sombre du système, clair posé, clair du système, sombre et clair en
 contraste renforcé, renforcé sans thème posé, et « le --line décoratif du handoff reste inchangé »)
Error: requête média inconnue : (min-width: 1024px)
 ❯ mediaMatches app/assets/css/control-tokens.spec.ts:53:33
 Test Files  1 failed | 4 passed (5)
      Tests  8 failed | 40 passed (48)
$ pnpm exec vitest run app/assets/css/tokens.spec.ts
      Tests  21 passed (21)
```

Pas de contournement : poser la règle dans `fonts.css` (hors des fichiers que lit ce test) le
garderait vert, mais seulement parce qu'il ne la voit plus ; c'est à décider, pas à choisir pour faire
passer un test. Deux suites possibles, à trancher par l'orchestrateur :

- (a) le correcteur, sous autorisation `D51-4`, ajoute `'(min-width: 1024px)'` à la table `MEDIA` de
  `control-tokens.spec.ts` (sans effet sur les couleurs : la règle ne porte que `--font-sans` et
  `--font-mono` ; l'état devrait sinon se dédoubler en largeur), puis le lead pose la règle dans
  `tokens.css` avec le test nouveau prévu ;
- (b) la règle va dans `fonts.css`, à côté des faces qu'elle cite (police et pile au même endroit),
  décision de placement à reporter dans CLAUDE.md ; aucun test existant à toucher.

Test nouveau prévu (non écrit, il échouerait sans la règle) : dans la règle
`@media (min-width: 1024px)` de `:root`, `--font-sans` vaut exactement la police du handoff, puis les
familles des faces de repli de `fonts.css` qui la concernent, dans leur ordre, puis la famille
générique du handoff ; de même pour `--font-mono` ; la règle ne porte rien d'autre ; la déclaration de
base reste celle du handoff (déjà vérifié par `tokens.spec.ts`).

Mesure avec la règle (build `generate:fixtures` de la règle non commitée, mêmes réglages, 3 passes,
`cls-probe.mjs`, sorties `fallback-media.txt` et `fallback-media-geo.txt`) :

| Largeur | Avant | Bureau seul | Avant, fractionnaire | Bureau seul, fractionnaire |
|---|---|---|---|---|
| 390 | 0,0227 | **0,0227** (×3) | 0,0228 | **0,0228** (×3) |
| 1024 | 0,0182 | 0,0004 (×3) | 0,0188 | 0,0004 (×3) |
| 1280 | 0,0547 | 0,0069 / 0,006 / 0,006 | 0,0544 | 0,0031 (×3) |
| 1920 | 0,0184 | 0,0029 (×3) | 0,0183 | 0,0001 (×3) |

À 390, mêmes sauts qu'avant (1 331 : 0,0038 ; 1 494 : 0,0182 ; 1 549 : 0,0005 ; 2 326 : 0,0002) et
seules Space Grotesk et JetBrains Mono chargées : le mobile revient exactement à l'état d'avant. La
première passe à 1280 porte un saut de 0,0009 à 737 ms (non reproduit aux deux suivantes).
Poids : CSS d'entrée 14 978 o / 3 435 o gzip (+939 / +242 depuis `0d09349`), `index.html`
inchangé (123 917 o / 20 240 o gzip).

Vérifications sans objet sur cette suite : aucune modification de code versionnée (lint, typecheck,
couverture et parcours de `3a17bee` restent valables) ; `.output/public` contient le build de la
règle non commitée, à régénerer. Point ouvert : le choix entre (a) et (b).

#### Fait (suite (a) retenue : `405c62f` du correcteur, puis la règle)

Commits :

- `190ad43` feat(web): polices de repli ajustées dans les piles du bureau (D51 (4))
- (ce commit) docs: convention des polices de repli du bureau et compte rendu

- `app/assets/css/tokens.css` : règle unique `@media (min-width: 1024px) { :root { … } }`, après la
  déclaration de base (inchangée, celle du handoff) : `--font-sans: 'Space Grotesk', 'Space Grotesk
  Fallback', 'Space Grotesk Fallback Roboto', sans-serif` et `--font-mono: 'JetBrains Mono',
  'JetBrains Mono Fallback', monospace` ; commentaire qui cite D51 (4). `:root[data-font='lisible']`,
  plus spécifique, l'emporte toujours au bureau.
- `app/assets/css/fonts-desktop-stack.spec.ts` (nouveau, projet `nuxt`, 4 tests) : reconstruit la
  pile attendue depuis `design/handoff-v6/tokens.css` (police, générique) et les familles des
  `@font-face` de `fonts.css` nommées « <police> Fallback… » (ordre du fichier) ; exige une seule règle
  `(min-width: ${BREAKPOINTS.portable}px)` dans `tokens.css`, qui ne contient que `:root`, qui ne porte
  que `--font-sans` et `--font-mono`, chacune égale à la pile attendue. Sans la règle : 4 échecs
  (`expected [] to have a length of 1 but got +0`, puis lecture d'une règle absente), règle retirée
  puis remise par l'outil d'édition avant le commit.
- CLAUDE.md, « Préférences → CSS » : convention des polices de repli (faces calculées, pile au bureau
  seulement, test qui la garde, nommage d'une nouvelle face).

#### Mesures (build commité `190ad43`, `generate:fixtures`, `cls-probe.mjs`, 3 passes)

| Largeur | Avant (`0d09349`) | Après | Avant, fractionnaire | Après, fractionnaire |
|---|---|---|---|---|
| 390 | 0,0227 | **0,0227** (×3) | 0,0228 | **0,0228** (×3) |
| 1024 | 0,0182 | 0,0004 (×3) | 0,0188 | 0,0004 (×3) |
| 1280 | 0,0547 | 0,006 (×3) | 0,0544 | 0,0031 (×3) |
| 1920 | 0,0184 | 0,0029 (×3) | 0,0183 | 0,0001 (×3) |

À 390, mêmes sauts qu'avant (1 339 : 0,0038 ; 1 473 : 0,0182 ; 1 514 : 0,0005 ; 2 329 : 0,0002) et
seules Space Grotesk et JetBrains Mono chargées ; au bureau, les faces de repli sont chargées
(`document.fonts`) et le seul saut restant est celui de la bascule vers Space Grotesk. Valeurs
identiques à la mesure de la règle non commitée (seule différence : la première passe à 1280 n'a plus
le saut isolé de 0,0009).

#### Vérifications ciblées (sur `190ad43`)

- `pnpm --filter @siteperso/web lint` et `typecheck` : verts.
- `pnpm exec vitest run app/assets/css/` (dans `apps/web`) : 6 fichiers, 52 tests verts
  (`tokens.spec.ts`, `control-tokens.spec.ts`, `fonts-fallback.spec.ts` compris).
- `pnpm --filter @siteperso/web test:coverage` : 145 fichiers, 1 228 tests, 100 % (instructions
  1472/1472, branches 797/797, fonctions 490/490, lignes 1310/1310).
- `generate:fixtures`, puis `pnpm exec playwright test --workers=2` sur `csp`, `design-system`,
  `matrix`, `hydration-shift`, `pages`, `smoke`, `title-overflow`, `top-bar-height`, `shell` et
  `mosaic` : **910 passés** (14,7 min).
- `pnpm integrity` : OK (base `origin/develop`, divergence `567527ca9cab`). Hook pre-commit vert.
- Mutation sans objet (ni `app/domain/` ni `app/data/` touchés) ; `pnpm db:down` sans objet (aucune
  base démarrée) ; conteneur Playwright laissé démarré ; sirv de la sonde arrêté.

#### Points ouverts

- Atkinson Hyperlegible (point ouvert 3 ci-dessus) et Android/Windows non mesurés (point 4) : inchangés.
