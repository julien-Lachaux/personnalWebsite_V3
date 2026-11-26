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

Mesures complètes : `/tmp/claude-1000/-home-jlachaux-Projets-personnalWebsite-V3-f11/27c0b126-55c9-42cb-99ad-d566be881142/scratchpad/js-before-fixtures.txt`
et `js-after-fixtures.txt` dans le même dossier (jetables).

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
