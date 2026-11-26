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
