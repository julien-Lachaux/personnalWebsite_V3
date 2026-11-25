# Revue de code du front V3 (lot F10), 23 novembre 2026

## En-tête

| | |
|---|---|
| Périmètre | `apps/web/` (app, i18n, test, scripts, configuration du paquet) ; docs du front (`docs/04`, `docs/05`, comptes rendus `lot-F*`). API et back hors périmètre, sauf `scripts/deploy/csp-hashes.mjs` et `docker/Caddyfile`, lus pour la cohérence de la CSP. |
| Commit | `add5a22` sur `lot/F10-revues` (develop à `ba79093` : tout le front fusionné) |
| Méthode | Lecture du code de production (domain, data, composables, composants, pages, configuration), puis des tests (unitaires et parcours) ; pour chaque soupçon, une sonde minimale contre le site généré (fixtures), avec le navigateur Chromium du service `playwright`. Aucun fichier du dépôt modifié hors de ce rapport. |
| Isolation | `.env` du worktree (`siteperso-v3-f10`, ports 5962 à 5965). Le worktree est partagé avec les revues de sécurité et d'accessibilité : je n'ai ni regénéré `.output/` ni arrêté leurs services. J'ai copié le site déjà généré (fixtures, 13:55) dans le dossier temporaire de session, je l'ai servi sur 127.0.0.1:5975 (et sur 5976 pour un parcours Playwright, `--output` hors du dépôt), et j'ai utilisé le conteneur `siteperso-v3-f10-playwright-1` (port 5964), déjà démarré par une autre revue. |
| Commandes | `git diff`, `grep`, `diff` ; sondes Node + Playwright `chromium.connect` (fichiers `probe-*.cjs` du dossier temporaire) ; `WEB_E2E_PORT=5976 pnpm exec playwright test test/mosaic.e2e.ts -g "cas des captures" --project=portable-1024 --project=desktop-1280 --workers=2 --output=<temporaire>` (journal `scratchpad/revue-code-mosaic.log`). Pas de `pnpm check` ni de mutation (consigne de l'orchestrateur). |
| Nettoyage | Serveurs `sirv` 5975 et 5976 arrêtés (vérifié : `ss -ltn`, aucun port 5975 ou 5976 à l'écoute) ; copie du site et sondes supprimées du dossier temporaire ; conteneur Playwright laissé en place (pas démarré par moi, il sert aux autres revues) ; `git status` ne montre que ce rapport. |

Défauts déjà connus, non comptés ici : barre du haut sur deux lignes à 1024 px en anglais à cause de « CV PDF (in French) » (lot F5c, point ouvert 3, prise en compte par la mosaïque), tests partiellement redondants relevés par les recettes F1, F2a, F2b, F3b, F4, F5a et F5b.

## Findings

| Id | Gravité | Sujet | Fichiers |
|---|---|---|---|
| RC-1 | majeur | « Cas des captures » de la mosaïque : test vert sans aucune assertion en anglais à 1024 px (retour anticipé décidé par une mesure faite pendant le test) | `test/mosaic.e2e.ts:197-201` |
| RC-2 | mineur | Le morceau Zod + fixtures (138 603 octets, 34 526 en gzip) est préchargé par le navigateur sur chaque accueil, et les fixtures partent en production | `app/data/fetch-cv.ts:35-43`, `app/data/select-cv-source.ts:5-7` |
| RC-3 | mineur | Code de production conservé uniquement pour des tests | `app/domain/preferences.ts:196-208`, `app/composables/shell/usePreferencesSync.ts:17-19` |
| RC-4 | mineur | Les composants appellent directement le domaine et la couche de données (règle « composables comme seul pont » non appliquée ni vérifiée) | `TechFilter.vue:18-29`, `ResultGroups.vue:12`, `ExperienceSection.vue:22`, `HomePage.vue:19`, `architecture.spec.ts:65-67` |
| RC-5 | mineur | Identité du titulaire en double : `<title>` lu dans le contrat, hors du modèle de vue ; description SEO figée dans les libellés | `HomePage.vue:49-51`, `i18n/locales/{fr,en}/common.json:11` |
| RC-6 | mineur | Pluriel français à zéro : « TypeScript, 0 expériences » | `TechOption.vue:23-31`, `i18n/locales/fr/experience.json:47`, `nuxt.config.ts:103` |
| RC-7 | mineur | Helpers des parcours recopiés dans 7 à 9 fichiers, avec des variantes qui divergent | `test/*.e2e.ts` |
| RC-8 | mineur | La CSP du parcours est une copie de celle du déploiement : le test vérifie sa copie, pas la politique servie | `test/csp.e2e.ts:32-92`, `scripts/deploy/csp-hashes.mjs:21-89` |
| RC-9 | mineur | Délais fixes dans les parcours, couplés à une constante de production | `test/experience.e2e.ts:259,321,352`, `test/mosaic.e2e.ts:379`, `TechFilter.vue:35` |
| RC-10 | info | Commentaires périmés ou contraires au code | `EasterEggWindow.vue:3-4`, `ContactButton.vue:3-4`, `test/sections.e2e.ts:172` |

Total : 0 bloquant, 1 majeur, 8 mineurs, 1 info.

---

## RC-1 : test « cas des captures » vert sans assertion (majeur)

**Fichiers** : `apps/web/test/mosaic.e2e.ts:197-238`.

**Défaut** : le test se garde par une mesure faite pendant son exécution :
`if (!((width === 1280 && height === 788) || (width === 1024 && height === 712))) return;`. Si la
zone n'a pas exactement la taille attendue, le test se termine sans rien vérifier et il est compté
comme réussi. Il tourne dans les 7 projets et les 2 langues (28 exécutions) ; seules 3 d'entre elles
contiennent des assertions. Le cas portable 1024 en anglais, que le test annonce couvrir, n'en
contient aucune : en anglais à 1024 px, la barre du haut fait 85 px (défaut connu du lot F5c), donc la
zone mesure 1024 × 683 et le test sort tout de suite.

**Scénario de défaillance** : une régression de la mise en page à 1024 px en anglais (position des
tuiles, tuile XP agrandie à x = 78, tuiles poussées hors de la zone) laisse ce test vert. Plus grave,
toute variation de la hauteur de la barre (police, libellé, réglage) désactive en silence les cas en
français aussi, sans qu'aucun rapport ne le montre.

**Reproduction** :

```
$ pnpm exec node scratchpad/revue-code/probe-zone.cjs     # site généré, mêmes fenêtres que les projets
1024x768 / zone=1024x712 topBar=56 assertions=oui
1024x768 /en zone=1024x683 topBar=85 assertions=NON (retour anticipé)
1280x844 / zone=1280x788 topBar=56 assertions=oui
1280x844 /en zone=1280x788 topBar=56 assertions=oui

$ WEB_E2E_PORT=5976 pnpm exec playwright test test/mosaic.e2e.ts -g "cas des captures" \
    --project=portable-1024 --project=desktop-1280 --workers=2
  ✓  2 [portable-1024] › … › en (/en) › cas des captures recalculés : 1280 × 844 et 1024 × 768 (551ms)
  ✓  1 [portable-1024] › … › fr (/) › cas des captures recalculés : 1280 × 844 et 1024 × 768 (1.2s)
  ✓  3 [desktop-1280] › … › fr (/) › cas des captures recalculés : 1280 × 844 et 1024 × 768 (1.2s)
  ✓  4 [desktop-1280] › … › en (/en) › cas des captures recalculés : 1280 × 844 et 1024 × 768 (1.3s)
  4 passed (4.1s)
```

Le cas anglais à 1024 passe en 551 ms, contre 1,2 s pour les autres : il n'a ni cliqué ni mesuré.

**Correction proposée** (test existant : triage puis correcteur, Justification-test) : choisir les cas
d'après la configuration (`testInfo.project.name` et la langue), pas d'après une mesure. Dans un cas
retenu, vérifier explicitement la zone attendue : une zone différente doit faire échouer le test, pas le
vider. Recalculer à la main le cas anglais à 1024 (zone de 683 px) ou le retirer de la liste
annoncée par le titre.

---

## RC-2 : schémas Zod et fixtures préchargés par le navigateur et livrés en production (mineur)

**Fichiers** : `apps/web/app/data/fetch-cv.ts:35-43` (`await import('./select-cv-source.js')` dans le
gestionnaire de `useAsyncData`), `apps/web/app/data/select-cv-source.ts:5-7` (import statique de
`FixtureCvSource`, donc des deux fixtures), `apps/web/app/composables/use-cv.ts`.

**Défaut** : d'après son commentaire, l'import dynamique du lot F9a fait que « le navigateur ne les
télécharge ni ne les évalue ». En réalité, Vite en fait un morceau client (`_nuxt/k2bm6MiX.js` dans
ce build) que Nuxt annonce par `<link rel="prefetch">` dans les pages d'accueil. Le navigateur le
télécharge donc à chaque visite, sans jamais l'exécuter. Ce morceau contient les schémas Zod, la source
API et les deux fixtures. Comme `select-cv-source.ts` importe `FixtureCvSource` de façon statique, les
fixtures font aussi partie du site de production, alors même que la source y est `api`.

**Scénario de défaillance** : chaque visiteur de `/` ou `/en` télécharge en arrière-plan environ 34 Ko
compressés (139 Ko bruts, deuxième plus gros morceau du site) qui ne servent à rien ; le site public
expose les fixtures de test (CV « Prénom Nom »). La CSP n'est pas violée, puisque le code n'est pas
évalué.

**Reproduction** :

```
$ grep -o '<link[^>]*k2bm6MiX[^>]*>' site/index.html
<link rel="prefetch" as="script" crossorigin href="/_nuxt/k2bm6MiX.js">
$ grep -c "Prénom" site/_nuxt/k2bm6MiX.js ; gzip -9 -c site/_nuxt/k2bm6MiX.js | wc -c
4
34526
$ pnpm exec node scratchpad/revue-code/probe-prefetch.cjs k2bm6MiX.js
/ : k2bm6MiX.js téléchargé ["200 138603 octets"] ; initiateur ["link"]
/en : k2bm6MiX.js téléchargé ["200 138603 octets"] ; initiateur ["link"]
/accessibilite : k2bm6MiX.js téléchargé [] ; initiateur []
```

**Correction proposée** : fournir le chargeur de source depuis `use-cv.ts` sous `import.meta.server`
(par exemple `loadSource: import.meta.server ? () => import('../data/select-cv-source.js') : …`). Vite
retire alors la branche du bundle client et le morceau n'existe plus côté navigateur. Dans
`select-cv-source.ts`, ne charger `FixtureCvSource` (import dynamique) que si `name === 'fixtures'`.
Ajouter un parcours ou un test de build qui vérifie qu'aucun `<link rel="prefetch">` de la page ne
mène à un morceau contenant les fixtures.

---

## RC-3 : code de production gardé uniquement pour des tests (mineur)

**Fichiers** : `apps/web/app/domain/preferences.ts:196-208` (`resetPreferences`),
`apps/web/app/composables/shell/usePreferencesSync.ts:17-19` (réexport de `DARK_QUERY`,
`REDUCED_MOTION_QUERY`, `rootAttributes`, « pour les appelants existants »).

**Défaut** : le commentaire de `resetPreferences` le dit lui-même : « cette fonction est conservée
parce que son test existant ne se modifie pas ». Aucun code de l'application ne l'appelle ; elle
reste mesurée par la couverture et par Stryker, et elle documente une règle (« Réinitialiser écrit les
valeurs par défaut ») que D11 a remplacée. Les réexports de `usePreferencesSync.ts` ne sont importés
que par son propre test. CLAUDE.md : « du code que l'application n'exécute jamais se supprime ».

**Scénario de défaillance** : un développeur ou un agent reprend `resetPreferences` (exporté, testé,
documenté) pour un nouveau bouton et réintroduit l'écriture des valeurs par défaut, contraire à D11 :
le site cesse alors de suivre le système.

**Reproduction** :

```
$ grep -rn "resetPreferences" app --include='*.ts' --include='*.vue' | grep -v "^app/domain/preferences.ts"
app/domain/preferences.spec.ts:10:  resetPreferences,
app/domain/preferences.spec.ts:292:describe('resetPreferences', () => {
app/domain/preferences.spec.ts:295:    const preferences = resetPreferences(storage, DARK_SYSTEM);
…
$ grep -rn "from '.*usePreferencesSync" app test | grep -v usePreferencesSync.ts
app/app.vue:11:import { usePreferencesSync } from …
app/error.vue:19:import { usePreferencesSync } from …
app/composables/shell/usePreferencesSync.spec.ts:20:} from './usePreferencesSync.js';   (seul importeur des réexports)
```

**Correction proposée** : par triage puis correcteur (suppression de tests existants, Justification-test),
retirer `resetPreferences` et son `describe`, et faire importer les constantes et `rootAttributes` par le
test depuis `domain/root-attributes.ts`, puis retirer le réexport.

---

## RC-4 : les composants appellent le domaine et les données sans passer par un composable (mineur)

**Fichiers** : `apps/web/app/components/experience/TechFilter.vue:18-29` (8 fonctions de
`domain/filter`), `ResultGroups.vue:12` (`filterExperiences`), `ExperienceSection.vue:22`
(`toggleTech`), `home/HomePage.vue:19` (`mapCv`), `shell/TileGrid.vue:30` ;
`apps/web/app/architecture.spec.ts:65-67` (règles vérifiées).

**Défaut** : la grille du front, `docs/05` (structure, l. 60 : « composables/ pont entre domain et
composants ») et CLAUDE.md (« la logique décide dans domain/, le composable relie l'état, le
composant affiche ») font des composables le seul pont. Pourtant, toute l'orchestration du filtre est
écrite dans `TechFilter.vue` : table des compteurs, choix d'Entrée, retrait au Retour arrière,
composition de l'annonce, délai de grâce. `architecture.spec.ts` ne contrôle que `domain/` et `data/`,
jamais ce que les composants importent.

**Scénario de défaillance** : cette logique échappe à Stryker, qui ne mute que `domain/` et `data/`. Une
inversion dans `submit()` ou dans `closeOnScroll()` n'est attrapée que si un test de composant vérifie
précisément ce cas. Par ailleurs, l'annonce (`announceResults`) et la liste (`filterExperiences`)
recalculent chacune le même filtre.

**Reproduction** :

```
$ grep -rn -E "^import \{[^}]*\} from '\.\./\.\./(domain|data)/" app/components --include='*.vue'
app/components/home/HomePage.vue:19:import { mapCv } from '../../data/map-cv.js';
app/components/experience/ExperienceSection.vue:22:import { toggleTech } from '../../domain/filter.js';
app/components/experience/ResultGroups.vue:12:import { filterExperiences, type FilterTech } from '../../domain/filter.js';
app/components/shell/TileGrid.vue:30:import { TILE_ORDER } from '../../domain/layout.js';
(+ TechFilter.vue:18-29 : addTech, announceResults, firstValidSuggestion, removeLastTech, removeTech,
   suggest, techCounters, toggleTech)
```

**Correction proposée** : regrouper l'état et les actions du filtre dans un composable (par exemple
`composables/experience/useTechFilterPanel.ts`, à côté de `useTechFilter`), et la lecture puis le
mapping du CV dans un `useCvView` ; ajouter à `architecture.spec.ts` une règle sur les imports de
valeurs de `components/`. Si la règle est jugée trop stricte pour les fonctions pures, la décision doit
être écrite dans `docs/05`.

---

## RC-5 : identité du titulaire lue hors du modèle de vue et recopiée dans les libellés (mineur)

**Fichiers** : `apps/web/app/components/home/HomePage.vue:49-51`,
`apps/web/i18n/locales/fr/common.json:11`, `apps/web/i18n/locales/en/common.json:11`,
`docs/04-front-donnees.md:31`.

**Défaut** : le titre de la page utilise `cv.profile.firstName` et `cv.profile.lastName`, lus
directement dans le contrat, alors que le composant affirme ne recevoir « jamais le contrat ».
`ProfileView` ne contient pas le nom, et `docs/04` range ces deux champs parmi les « non affichés ».
De son côté, la description SEO de chaque page (`seo.description`) recopie en dur « Julien Lachaux,
développeur full-stack ». Le nom a donc deux sources, l'API et les libellés, et le titre du métier en
a deux aussi, `profile.title` et les libellés.

**Scénario de défaillance** : si le nom ou l'intitulé change en base, le `<title>` et `og:title`
suivent, mais la description reste figée. On le voit déjà dans le build de fixtures.

**Reproduction** :

```
$ grep -o '<title>[^<]*</title>\|<meta name="description"[^>]*>' site/index.html
<title>Prénom Nom · Développeur full-stack</title>
<meta name="description" content="Site et CV de Julien Lachaux, développeur full-stack : expériences, …">
```

**Correction proposée** : ajouter le nom affiché à `ProfileView` dans `mapProfile` (et mettre `docs/04`
à jour), construire le titre à partir de la vue, et paramétrer la description
(`t('seo.description', { name, title })`), sans nom en dur dans les libellés.

---

## RC-6 : pluriel français à zéro (mineur)

**Fichiers** : `apps/web/app/components/experience/TechOption.vue:23-31`,
`apps/web/i18n/locales/fr/experience.json:47` (`"{name}, {n} expérience | {name}, {n} expériences"`),
`apps/web/nuxt.config.ts:103` (aucune `pluralRules`).

**Défaut** : faute de règle de pluriel propre au français, vue-i18n applique sa règle par défaut, qui
met 0 au pluriel. Une techno choisie dont la combinaison ne donne aucun résultat complet (cas
possible par une URL partagée : `parseTechParam` ne vérifie pas que la combinaison a des résultats)
est donc annoncée « 0 expériences ». En français, zéro se construit au singulier, comme le dit déjà
`experience.tech.disabled`.

**Reproduction** :

```
$ pnpm exec node scratchpad/revue-code/probe-plural.cjs     # /?tech=typescript,nodejs, 1280 × 844, panneau ouvert
/ [ "TypeScript, 0 expériences | visible : TypeScript 0",
    "Node.js, 0 expériences | visible : Node.js 0" ]
/en [ "TypeScript, 0 experiences | visible : TypeScript 0", … ]
```

**Correction proposée** : déclarer une règle française dans la configuration de vue-i18n
(`pluralRules: { fr: (n) => (n <= 1 ? 0 : 1) }`, via `i18n.vueI18n`) et ajouter un test de composant
pour le compteur 0 d'une techno choisie.

---

## RC-7 : helpers des parcours recopiés, variantes divergentes (mineur)

**Fichiers** : `apps/web/test/*.e2e.ts`.

**Défaut** : l'attente de fin des animations finies (`waitForSettledAnimations` ou `settled`) est
copiée à l'identique dans 7 fichiers : shell, ai-placeholder, defects-f8, design-system (en ligne),
matrix, overflow et experience. Trois autres variantes s'en écartent. `mosaic.e2e.ts:62-66` attend
`animation.finished` sur tout le sous-arbre de la mosaïque, sans exclure les animations infinies.
`sections.e2e.ts:64-70` et `experience.e2e.ts:184-188` font la même attente, mais sur un seul élément.
De même, `WCAG_22_AA`, `STORAGE_KEY` et `tabsMode` sont redéfinis dans 9 fichiers chacun.

**Scénario de défaillance** : une correction apportée à un helper (ce fut le cas en F5D-2 pour les
animations infinies) n'atteint pas les autres copies. La variante de la mosaïque attendrait
indéfiniment si une animation infinie apparaissait dans une tuile. Le curseur du placeholder IA (D27)
en est une, mais `mosaic.e2e.ts` ne tourne aujourd'hui que sur le site avec section IA (voir
« Points ouverts »).

**Reproduction** :

```
$ cd apps/web/test
$ grep -l "animation.effect?.getComputedTiming().endTime === Infinity" *.ts | wc -l
7
$ grep -l "const WCAG_22_AA" *.ts | wc -l ; grep -l "const STORAGE_KEY = 'siteperso:preferences'" *.ts | wc -l ; grep -l "function tabsMode" *.ts | wc -l
9
9
9
```

**Correction proposée** : créer un module commun `test/support/` (fichier de support : autorisation du
lead-architecte) qui exporte `waitForSettledAnimations(page, scope?)`, `axe`, `WCAG_22_AA`,
`STORAGE_KEY`, `tabsMode`, puis faire migrer les parcours en un commit dédié, sans changer leurs
assertions.

---

## RC-8 : la CSP du parcours est une copie de celle du déploiement (mineur)

**Fichiers** : `apps/web/test/csp.e2e.ts:32-92` (`cspHash`, `inlineHashes`, `collectHashes`,
`buildPolicy`), `scripts/deploy/csp-hashes.mjs:21-89`.

**Défaut** : le parcours ne lance pas le script du déploiement. Il en recopie les quatre fonctions,
identiques à la mise en forme près. Le commentaire de tête l'assume (« le front n'en dépend pas »).
L'oracle mesure donc le site contre la copie, pas contre la politique que Caddy sert
(`csp.caddy`, produit par `web-generate.sh`).

**Scénario de défaillance** : si l'on resserre la politique du déploiement (nouvelle directive,
`require-trusted-types-for`, autre filtrage des scripts), `csp.e2e.ts` reste vert alors que le site
servi peut être bloqué. À l'inverse, une correction faite dans le test ne protège pas la production.

**Reproduction** :

```
$ diff <(sed -n 80,91p apps/web/test/csp.e2e.ts | sed 's/: InlineHashes//; s/: string//') \
       <(sed -n 77,88p scripts/deploy/csp-hashes.mjs) && echo "buildPolicy : copie identique"
buildPolicy : copie identique
$ grep -n "csp-hashes" apps/web/test/csp.e2e.ts
14:// (`scripts/deploy/csp-hashes.mjs`, côté back) ; le front n'en dépend pas. …   (commentaire seulement, aucun import)
```

**Correction proposée** : importer `collectHashes` et `buildPolicy` depuis `scripts/deploy/csp-hashes.mjs`
(le script exporte déjà ces fonctions), ou ajouter un test qui compare la politique du parcours à la
sortie du script sur le même dossier. C'est une décision transverse (front et back) : à l'orchestrateur.

---

## RC-9 : délais fixes dans les parcours (mineur)

**Fichiers** : `apps/web/test/experience.e2e.ts:259,321,352` (`waitForTimeout(600)`),
`apps/web/test/mosaic.e2e.ts:379` (`waitForTimeout(300)`), constante couplée
`apps/web/app/components/experience/TechFilter.vue:35` (`SCROLL_GRACE_MS = 450`).

**Défaut** : la grille du front demande des parcours sans délai fixe. Les trois attentes de 600 ms
servent à dépasser le délai de grâce de 450 ms du panneau, ou à vérifier qu'il ne se rouvre pas ;
celle de 300 ms vérifie l'absence de recalcul après l'animation. Ces durées sont recopiées à la main
d'après la production.

**Scénario de défaillance** : si `SCROLL_GRACE_MS` passe au-dessus de 600 ms, le test « se ferme au
défilement » échoue sans qu'il y ait de défaut. Sous charge (CI saturée, D26), une réouverture tardive
au-delà de 600 ms passe inaperçue. Chaque passe paie aussi 2,1 s × 2 langues × 7 projets d'attente.

**Reproduction** :

```
$ grep -n "waitForTimeout" apps/web/test/*.ts
test/experience.e2e.ts:259:      await page.waitForTimeout(600);
test/experience.e2e.ts:321:      await page.waitForTimeout(600);
test/experience.e2e.ts:352:      await page.waitForTimeout(600);
test/mosaic.e2e.ts:379:        await page.waitForTimeout(300);
$ grep -n "SCROLL_GRACE_MS =" apps/web/app/components/experience/TechFilter.vue
35:const SCROLL_GRACE_MS = 450;
```

**Correction proposée** (tests existants : triage puis correcteur) : piloter l'horloge avec `page.clock`
(`install` puis `fastForward` au-delà du délai de grâce) au lieu d'attendre ; pour l'absence de
recalcul, comparer après `requestAnimationFrame` ×2 et `settled`, sans durée.

---

## RC-10 : commentaires périmés ou contraires au code (info)

**Fichiers et reproduction** :

```
$ sed -n 3,4p apps/web/app/components/experience/EasterEggWindow.vue
// pause professionnelle. Des lignes de terminal apparaissent une à une (textes de `data/site-content.json`,
// `easterEgg.lines`), …          ← les textes viennent de l'i18n (experience.easterEgg.*) ; lire
                                    site-content.json à l'exécution est interdit (docs/04)
$ sed -n 3,4p apps/web/app/components/shell/ContactButton.vue
// … Tant que l'adresse n'est pas configurée …, le bouton n'est pas rendu   ← AppShell.vue:78-83 lève
                                    avant (la branche `v-if` n'est jamais atteinte dans le site)
$ sed -n 172p apps/web/test/sections.e2e.ts
        // Bureau, avant la mosaïque : …     ← la mosaïque existe depuis F6
```

Le commentaire de `fetch-cv.ts:35-38` est faux lui aussi (voir RC-2).

**Correction proposée** : corriger ces commentaires au prochain passage dans ces fichiers.

---

## Fait

- Lecture complète de `apps/web/app` (domain, data, composables, composants, pages, layout, greffon,
  `app.vue`, `error.vue`), de `nuxt.config.ts`, des configurations de test (Vitest, Stryker, Playwright,
  ESLint), de `scripts/clean-cv-pdf.sh`, des 16 parcours (en détail mosaic, csp, experience,
  sections, journeys, matrix, ai-placeholder), d'un échantillon des tests unitaires et de composants
  (architecture, préférences, assertions faibles cherchées par motif), de `docs/04`, de `docs/05` et des
  comptes rendus F5c, F6, F8 et des recettes.
- Sondes reproduites sur le site généré : zone de la mosaïque à 1024 et 1280 dans les deux langues,
  barre du haut à 1024, 1100, 1199 et 1200, transitions sous mouvement réduit, nom accessible des
  technos à compteur nul, préchargement du morceau Zod et fixtures, balises SEO des six pages.
- Soupçons vérifiés puis écartés : boucle vide du test « mouvement réduit » de la mosaïque à 1024 (0
  animation sous `reduce`, 10 sans : l'oracle détecterait bien une régression) ; slug d'une puce de
  carte absent des groupes de technos (la même requête `selectPublishedSkills` alimente les deux côtés
  de l'API) ; fuites d'écouteurs (`useActionBar`, `useScrollHint`, `usePreferencesSync`,
  `useShellMode`, `TileGrid`, `Window`, `Popover`, `TechFilter` : tous retirés au démontage) ; détection
  de l'environnement de test dans le code de production (aucune) ; `v-html` (interdit par ESLint,
  absent) ; liens externes (`LinkButton` pose `noopener noreferrer`).

## Non fait

- Échec de la génération quand l'API ne répond pas ou répond hors contrat : non rejoué de bout en
  bout. `nuxt generate` aurait réécrit `.output/` et `.nuxt/`, que partagent les deux autres revues de
  ce worktree. Ce cas est couvert par `use-cv-errors.spec.ts`, `fetch-cv.spec.ts` et
  `api-cv-source.spec.ts`, que j'ai lus.
- Pas de `pnpm check` ni de mutation (consigne de l'orchestrateur ; la CI les a passés).

## Décisions

- La barre du haut sur deux lignes à 1024 px en anglais est un défaut connu (F5c) : je ne la compte pas.
  Je la cite seulement comme cause du retour anticipé de RC-1.
- Les non-null (`!`) de production sont laissés de côté. Ils remplacent des branches défensives que la
  règle de couverture à 100 % aurait rendues mortes ; chacun que j'ai lu repose sur un invariant du
  gabarit ou de l'API.
- Les retours anticipés décidés par la taille d'écran (onglets ou mosaïque, `matrix` à 100 % sous
  1024) sont documentés et vérifient quelque chose dans l'autre branche : ils ne sont pas comptés. Seul
  le retour décidé par une mesure faite pendant le test (RC-1) l'est.

## Points ouverts

1. **Refus des garde-fous** (aucun contourné) :
   - `pnpm exec node …/probe-lang.cjs` : « écriture opaque (node) qui mentionne un oracle (`**/*`) ».
     La sonde devait relever, avant et après l'hydratation, les liens du sélecteur de langue sur les six
     pages, dont les 404 servies comme par le proxy (`page.route('**/*', …)`). Abandonnée sans la
     réécrire ; le parcours `csp.e2e.ts` couvre la navigation de langue sur l'accueil.
   - `pnpm exec node …/i18n-keys.mjs <apps/web>` : « écriture opaque (node) qui mentionne un oracle
     (`app/`) ». La sonde devait vérifier que chaque clé littérale passée à `t()` existe en fr et en en.
     Abandonnée ; `i18n-messages.spec.ts` garantit seulement que les deux langues ont les mêmes clés.
   - Une première commande qui écrivait un script (`pairs.mjs`) et l'exécutait d'un seul tenant a été
     refusée (« script écrit par la même commande »). J'ai suivi la consigne du refus : script écrit
     d'abord par l'outil d'écriture, puis exécuté séparément. Je le signale pour que l'orchestrateur
     juge.
2. **Attente sans fin possible dans `mosaic.e2e.ts`** (RC-7) : non reproduite, car il aurait fallu
   générer le site sans IA (`generate:without-ai`, qui met `.output/public` de côté pendant la
   génération) dans le worktree partagé.
3. **Clés `v-for` sur le texte** (`ExperienceCard.vue` : `:key="achievement"`, `ProfileSection.vue` :
   `:key="tagline"`) : deux réalisations ou deux accroches identiques venues de l'API donneraient des
   clés en double. Non reproduit (il faudrait monter le composant avec des données forgées) ; à
   trancher : clé par index ou unicité garantie par le contrat.
