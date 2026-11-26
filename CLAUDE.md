# CLAUDE.md : conventions du dépôt pour tous les agents

Site perso V3 de Julien, back-end TypeScript et front Nuxt. Les décisions de référence sont dans
`docs/` : `00-etat-des-lieux-v2.md`, `01-modele-de-donnees.md` (tables et contrat d'API),
`02-stack-technique.md`, `03-organisation-agents.md` (lots, rôles, flux git), `04-front-donnees.md`
(données du front), `05-front-organisation.md` (décisions D1 à D8, lots F0 à F10). Elles sont
validées : on les applique, on ne les rediscute pas dans le code.

## Structure

```
apps/api/                 API NestJS 12 sur Fastify (ESM), architecture hexagonale
  src/domain/             types et règles métier : AUCUNE dépendance Nest, Drizzle, Fastify
  src/application/        cas d'usage et ports (interfaces) : classes pures, pas de décorateur
  src/infrastructure/
    config/               variables d'environnement validées par Zod (APP_CONFIG)
    db/                   Drizzle + driver postgres, implémentation des ports (DATABASE_CLIENT)
    http/                 Nest : create-app.ts, app.module.ts, problem/, health/, docs/,
                          puis un dossier par ressource (profile/, skills/, cv/…)
  src/cli/                points d'entrée Node sans Nest : migrate.ts, seed.ts, reset.ts (scripts db:*),
                          provision-api-role.ts (rôle PostgreSQL de lecture seule de l'API, prod)
  test/                   tests e2e (*.e2e-spec.ts) via app.inject contre le Postgres de test,
                          fichiers en parallèle, une base par processus Vitest copiée d'une base
                          modèle (lot 14) ; test/support/database.ts : resetTestDatabase(), openTestSql()
apps/web/                 front Nuxt 4 en génération statique (FR, EN) : voir « Front » plus bas
packages/contracts/       schémas Zod partagés + document OpenAPI 3.2.0 (createOpenApiDocument)
db/migrations/            SQL manuel NNNN_description.sql (source de vérité du schéma)
db/seeds/                 contenu SQL idempotent (upsert sur slug)
docker-compose.yml        postgres (dev, :5432), postgres-test (:5433, tmpfs) et playwright
                          (navigateurs des e2e du front, :3100) ; ports et nom de projet
                          surchargeables par un `.env` racine (worktrees en parallèle)
docs/                     décisions validées ; ne pas reformater (exclu de Prettier)
docs/comptes-rendus/      compte rendu de chaque agent (lot-N-role.md)
.claude/agents/           les quinze agents spécialisés (rôle, fichiers, méthode, interdits)
.claude/hooks/            garde-fous contre le contournement des tests (hooks de .claude/settings.json)
scripts/ci/               check-tests-integrity.sh : intégrité des tests (CI et pnpm check) ;
                          release.mjs : version et changelog (lot 23)
```

## Règles hexagonales

- Dépendances dans un seul sens : `infrastructure` → `application` → `domain`. Le domaine
  n'importe rien d'externe ; l'application n'importe que le domaine, `@siteperso/contracts`
  et ses propres ports.
- Nest n'apparaît que dans `infrastructure/http` (et dans les modules Nest de `config`/`db`).
  Les cas d'usage sont des classes sans décorateur, fournis aux modules par `useFactory`
  avec `inject: [PORT_TOKEN]` (voir `health/health.module.ts`).
- Les ports sont des interfaces TypeScript + un jeton `Symbol` dans `application/.../ports/`.
  L'implémentation Drizzle vit dans `infrastructure/db/`. Les dépôts reçoivent
  `DrizzleDatabaseClient` à la construction et utilisent `client.db` ; ce sont des classes sans
  décorateur ni import de Nest (seul `db/database.module.ts` en importe), câblées par les modules de
  `infrastructure/http` en `useFactory` + `inject: [DrizzleDatabaseClient]`. `src/architecture.spec.ts`
  vérifie ces règles d'import.
- Pas de décorateurs métier, pas de pipes de validation magiques : les DTO et query params
  sont des schémas Zod de `@siteperso/contracts`, validés par un appel explicite
  (`Schema.safeParse`) dans le controller.
- Le SQL de `db/migrations` est la source de vérité ; le schéma Drizzle en découle, jamais
  l'inverse. Pas de `drizzle-kit generate`.
- Soft delete partout (docs/01, lot 9) : chaque table d'entité porte `deleted_at timestamptz null`,
  distinct de `published`. Le seed marque une entité disparue des fichiers et démarque une entité
  revenue ; un dépôt ne sert jamais une ligne marquée (`deleted_at is null` dans toute requête) ni ses
  traductions et liaisons. Aucune suppression physique dans le code : purge manuelle par `db:deleted:*`.
- Repli de langue par ligne (docs/01, lot 9) : `translated(en, fr, 'champ')` sert la ligne `en` entière
  si elle existe, sinon la ligne `fr` entière ; jamais de mélange dans une entité. Une traduction `en`
  d'une entité publiée doit être complète, le seed échoue sinon.
- Méthode non déclarée sur une route existante : 405 problem+json avec `Allow: GET, HEAD, OPTIONS`,
  produit par l'API (parité dev/prod) ; route inconnue : 404.
- Erreurs : le domaine lève des `DomainError` (`EntityNotFoundError` → 404). Le code HTTP
  lève des `HttpException` Nest. Le filtre global `ProblemDetailsFilter` traduit tout en
  RFC 9457 `application/problem+json` ; une erreur inattendue donne un 500 au détail
  générique, jamais de message ni de pile.
- Réponses JSON stables et décrites dans le contrat OpenAPI. Toute nouvelle route est ajoutée
  dans `packages/contracts/src/openapi/document.ts` (`routes`, `namedSchemas`) avec ses schémas.
- Contrat OpenAPI **3.2.0** (plus haute version qu'`utoipa` 6 émet côté Rust), généré par
  `@asteasolutions/zod-to-openapi` (`OpenApiGeneratorV32`) ; `info.version` 1.0.0 = version du
  contrat. Les noms et descriptions viennent de `.meta({ id, description })` natif de Zod 4 :
  pas d'`extendZodWithOpenApi`, pas de `.openapi()`. Un schéma de réponse n'a pas de `.default()`
  (le générateur rendrait le champ optionnel) : `default` se met en annotation dans `.meta()`.

## Règle « modules isolés » (lot 3, deux agents en parallèle)

Chaque ressource de `docs/01` a déjà son module enregistré dans `AppModule` :
`src/infrastructure/http/<resource>/<resource>.module.ts` + `.controller.ts` (GET en 501).
Pour implémenter une ressource, un agent ne crée ou ne modifie des fichiers QUE dans :

- `apps/api/src/infrastructure/http/<resource>/`
- `apps/api/src/application/<resource>/` (cas d'usage, ports)
- `apps/api/src/domain/<resource>/` (types)
- `apps/api/src/infrastructure/db/<resource>/` (dépôt Drizzle)
- `apps/api/test/<resource>.e2e-spec.ts`
- `packages/contracts/src/<resource>/` (schémas Zod)

Fichiers PARTAGÉS, interdits aux agents de ressource : `app.module.ts`, `create-app.ts`,
`main.ts`, `problem/*`, `config/*`, `db/database.module.ts`, `db/drizzle-database-client.ts`,
`packages/contracts/src/index.ts`, `packages/contracts/src/openapi/document.ts`,
tout fichier de configuration racine. Si une ressource a besoin d'un changement partagé
(export dans `index.ts`, chemin OpenAPI), l'agent le signale dans son compte rendu et
l'orchestrateur l'applique en un commit dédié. Le module `cv` agrège les cas d'usage des
autres ressources : il les importe par leurs modules, sans dupliquer de requête.

## Front (`apps/web`, docs/05)

Nuxt 4 (`@siteperso/web`), TypeScript strict (options de `tsconfig.base.json` reportées dans
`nuxt.config.ts`), génération statique (`nuxt generate` → `.output/public`) : aucun serveur Node du
front en production. Référence du design : `apps/web/design/handoff-v6/` (copie versionnée du
handoff v6, D7 ; `SPEC.md` fait foi, captures de `design/reference/` = oracles de régression
visuelle ; exclu de Prettier et d'ESLint).

```
apps/web/
  nuxt.config.ts          modules, i18n, prérendu, runtimeConfig (fichier partagé)
  app/
    app.vue               lang, hreflang, canonical (useLocaleHead), lien d'évitement,
                          usePreferencesSync() une seule fois, useSiteSeo(), <NuxtLayout> ;
                          fichier partagé
    error.vue             page d'erreur (404 et autres statuts), rendue À LA PLACE d'app.vue : refait
                          lang, lien d'évitement, préférences ; noindex, sans canonique (partagé)
    layouts/annex.vue     en-tête des pages annexes (lien vers l'accueil, accessibilité, langue,
                          thème) ; `routeRules` `appLayout: 'annex'` (nuxt.config.ts), et
                          `<NuxtLayout name="annex">` dans error.vue
    plugins/              localized-error-page.server.ts : page 404 anglaise prérendue (partagé)
    architecture.spec.ts  règles d'import des couches, vérifiées par le code
    domain/               logique pure : AUCUN import de vue, nuxt, #imports, #app, ni des
                          composants, composables ou données ; testée sans Nuxt (projet unit)
    data/                 port CvSource, ApiCvSource, FixtureCvSource, mapping contrat → vue
                          (docs/04) ; n'importe aucun composant ni aucune page
    components/base/      éléments de base (lot F1, puis partagés)
    components/<section>/ un dossier par section : profile, experience, recommendations, ai, shell
    components/shell/AppShell.vue   coquille de la page : en-têtes selon le mode, <main id="contenu">,
                          onglets et glissement, un slot par section (partagé, lead)
    components/home/      HomePage : CV lu au build (useCv), mapCv, sections dans AppShell (partagé)
    components/annex/     AnnexPage : <main id="contenu">, retour à l'accueil, fenêtre `>_ fichier`
                          des pages annexes (partagé, lead)
    composables/          pont entre domain et composants (état, URL, préférences) ;
                          sous-dossier par section importé explicitement ; use-cv.ts (partagé) :
                          seul lien entre data/ et useAsyncData ; seo/useSeo.ts (partagé) :
                          useSiteSeo (défauts de la langue), usePageSeo (titre, description),
                          useUnindexedPage (page hors index, lue par app.vue : useIndexedPage)
    pages/                index, accessibilite (`/accessibilite`, `/en/accessibility` par
                          `i18n.pages` de nuxt.config.ts), travaux (`/travaux`,
                          `/en/work-in-progress`, lot 31, hors index) ; fichiers partagés
    assets/css/           fonts.css (@font-face), tokens.css (tokens du handoff, thèmes, interface
                          des préférences), control-tokens.css (tokens ajoutés par décision :
                          bordure des contrôles D12, cible minimale D17), base.css (reset, focus,
                          réglages), motion.css (@keyframes partagés : glissement des onglets ;
                          durées hors handoff --dur-slide, --dur-egg-line, --dur-egg-bar, réduites
                          avec les autres) ; fichiers partagés
  i18n/locales/<langue>/  libellés d'interface, fr/ et en/ : common.json (partagé) et un fichier
                          par section (shell, profile, experience, recommendations, ai) qui ne
                          porte que son espace de clés ; mêmes clés dans les deux langues
                          (app/i18n-messages.spec.ts)
  public/                 fonts/<police>/ (woff2 + OFL.txt, D6), cv/cv-<langue>.pdf (D22), favicon
  scripts/clean-cv-pdf.sh nettoyage des métadonnées d'un CV PDF (qpdf en conteneur)
  test/                   parcours Playwright (*.e2e.ts), support et fixtures de test ;
                          support/e2e.ts : assistants communs des parcours (axe WCAG 2.2 AA,
                          préférences, palettes, tabsMode, gotoMounted, waitForHydration,
                          waitForSettledAnimations), exercés par e2e-support.e2e.ts (lot F11) ;
                          un nouveau parcours les importe au lieu d'en recopier une version
```

- **Couches** : la logique décide dans `domain/`, le composable relie l'état, le composant affiche.
  Un composant peut importer une fonction pure de `domain/`, jamais `data/` (sauf `HomePage`, `mapCv`) :
  D37, vérifié par `app/architecture-components.spec.ts`.
  Les auto-imports de Nuxt ne servent pas dans `domain/` ni `data/` : ces dossiers sont testés dans
  le projet Vitest `unit`, sans Nuxt, où un `ref()` non importé échoue. Les contenus viennent de
  l'API (`GET /cv?lang=` au build) ou de fixtures validées par `@siteperso/contracts`, jamais de
  `site-content.json` à l'exécution.
- **Règle « modules isolés » du front** : un agent de section n'écrit que dans
  `components/<section>/`, `composables/<section>/`, ses tests et ses fichiers de libellés
  `i18n/locales/{fr,en}/<section>.json` ; les fichiers partagés (configuration Nuxt, `app.vue`,
  `error.vue`, `layouts/`, `plugins/`, `components/annex/`, `composables/seo/`, `pages/`, `assets/css/`, `components/base/` après F1, `data/` hors F4, `common.json`, configurations de test et de lint) sont réservés
  au lead-architecte (détail dans `.claude/agents/dev-front.md`).
- **i18n** : `@nuxtjs/i18n`, FR par défaut sans préfixe, EN sous `/en/...`
  (`prefix_except_default`), pas de redirection selon le navigateur ; `useLocaleHead` pose `lang`,
  `hreflang` (fr, en, x-default) et `canonical` en URL absolue (`NUXT_PUBLIC_I18N_BASE_URL`).
  Toute chaîne visible passe par `t()`, dans les deux langues au même commit : un texte ou un nom
  accessible écrit en dur dans un gabarit, ou un libellé anglais recopié du français hors liste des
  mots identiques, fait échouer `app/i18n-hardcoded.spec.ts` ; `test/pages.e2e.ts` cherche les
  libellés français dans les pages `/en`. Chemin anglais propre à une page : `i18n.pages`
  de nuxt.config.ts (`customRoutes: 'config'`, clé = nom de la route), liens par
  `localePath('/chemin-fr')`. Pas de `definePageMeta` dans une page : il laisse une branche que les
  tests de composants n'exécutent pas (gabarit par `routeRules` `appLayout`).
- **Référencement et pages annexes (lot F7)** : chaque page pose son titre et sa description par
  `usePageSeo` (pas de description par défaut : `useSiteSeo` n'en pose plus, lot F11) ; l'accueil tire les
  siens de la vue du CV (`CvView.name`, `profile.title`, `seo.description` paramétrée, lot F11) :
  aucun nom du titulaire écrit dans un libellé qu'une page peut lire au CV ; `og:title` suit le
  titre (`%s`), `og:url` et `og:locale` viennent de `useLocaleHead` ; pas d'`og:image`. `sitemap.xml`
  et `robots.txt` sont écrits à la fin du prérendu (`nuxt.config.ts`) depuis les canoniques et
  hreflang des pages générées (`domain/sitemap.ts`) : une page sans canonique (redirection, erreur)
  n'y entre pas, aucune liste de routes à tenir. Une page hors index (page « travaux en cours »,
  lot 31) appelle `useUnindexedPage` : `noindex`, et app.vue n'y pose ni canonique, ni hreflang, ni
  `og:url`, ni `og:locale` ; une page qu'aucun lien n'atteint s'ajoute à `nitro.prerender.routes`. Pages 404 : `/404.html` (Nuxt,
  `experimental.prerenderErrorPages`) et `/en/404.html` (`domain/error-pages.ts`), servies par le
  proxy avec le statut 404 (le `sirv` des parcours répond 404 sans corps ; `page.route` reproduit le
  proxy). Pages d'erreur serveur (lot 30) : `/50x.html` et `/en/50x.html` (`domain/server-error-page.ts`),
  rendues par `error.vue` puis privées de l'application au prérendu (seul le script de thème reste) :
  aucune hydratation, servies par le proxy pour 500, 502, 503 et 504 avec ce statut, à l'adresse demandée.
- **Accessibilité** : WCAG 2.2 AA (D4, SPEC § 10) ; vrais `button`, `a`, `input` + `label`, jamais
  de clic sur un `div` ; focus visible ; cibles de 44 px sur mobile et tablette, sauf les puces de
  techno (D17 : hauteur de la maquette, au moins 24 × 24 px par `--target-min`, WCAG 2.5.8) ;
  contrastes ≥ 4,5:1 dans les deux thèmes et en contraste renforcé ; une bordure qui identifie un
  contrôle (piste, contour de puce, segment, bouton secondaire, champ, panneau superposé) prend
  `--line-control` ou `--border-control` (≥ 3:1, D12, `control-tokens.spec.ts`), le `--line` du
  handoff restant décoratif ; `prefers-reduced-motion` ; tailles en `rem`. ESLint (`eslint-plugin-vue`, `eslint-plugin-vuejs-accessibility`, zéro avertissement)
  interdit `v-html` ; axe tourne dans chaque parcours Playwright (étiquettes WCAG 2.2 AA).
- **Préférences → CSS (lot F1a)** : la seule interface est un jeu d'attributs posés sur `<html>`
  (détail en tête de `app/assets/css/tokens.css`) ; aucun composant ne calcule une couleur ou une
  taille en JS. `data-theme="sombre|clair"` (absent : suit `prefers-color-scheme`, repli sans JS ;
  le script de thème D5 le pose toujours), `data-contrast="renforce"` (avec `data-theme`),
  `data-text-size="100|115|130"` (facteur de la taille racine, tout en `rem`), `data-font="lisible"`
  (Atkinson Hyperlegible, téléchargée seulement alors), `data-spacing="augmente"` (WCAG 1.4.12),
  `data-links="soulignes"`, `data-motion="reduit|normal"` (absent : suit `prefers-reduced-motion` ;
  `normal` = choix explicite de garder les animations). Les composants utilisent les variables
  (`--bg`, `--text`, `--accent`…, `--font-sans`, `--font-mono`, `--font-size-*`, `--dur-*`,
  `--ease-*`), jamais une couleur, une police ou une durée écrite en dur ; aucune taille de texte en
  px (vérifié par `app/assets/css/tokens.spec.ts`, avec la fidélité au handoff et les contrastes des
  quatre palettes). Classes globales : `.skip-link` (lien d'évitement, visible au focus) et
  `.visually-hidden`. Polices dans `public/fonts/` (Fontsource 5.3.0, OFL), aucune requête tierce.
- **Configuration et données personnelles** : valeurs publiques en `NUXT_PUBLIC_*`, figées au build,
  modèle `apps/web/.env.example` (à copier en `apps/web/.env`, jamais commité). L'adresse du bouton
  « Lancer l'entretien » est `NUXT_PUBLIC_CONTACT_EMAIL` (`useRuntimeConfig().public.contactEmail`) :
  jamais de vraie adresse dans le dépôt (code, tests, fixtures), placeholder `contact@example.org` ;
  vide ou invalide, la génération échoue (`AppShell`). Source du contenu en configuration privée
  (absente des pages) : `NUXT_CV_SOURCE` (`api` par défaut, ou `fixtures`) et `NUXT_API_BASE_URL`
  (sans `/api/v1`) ; une API injoignable fait échouer `nuxt generate` avec sa cause, jamais de repli
  sur les fixtures. Liens externes en `rel="noopener noreferrer"`.
- **CV PDF (D22)** : seule exception à la règle des données personnelles, décidée par Julien :
  `apps/web/public/cv/cv-fr.pdf` est son CV tel quel, e-mail et téléphone visibles compris ; ce n'est
  pas une fuite et aucune revue ne le signale comme telle. Ses métadonnées sont nettoyées
  (`bash apps/web/scripts/clean-cv-pdf.sh <source> <destination>`, vérifié par `app/cv-pdf.spec.ts`).
  Le bouton « CV PDF » est un menu des deux versions (D44) : une version absente de `public/cv/`
  (liste relevée au build, `runtimeConfig.public.cvFiles`) reste affichée, inactive, avec
  « (bientôt) » (`app/domain/cv-link.ts`, `useCvLink`).
- **Thème sans flash (D5)** : script en ligne en tête (`app/domain/theme-script.ts`, posé par
  `nuxt.config.ts`) qui pose les attributs de `<html>` avant le premier affichage avec la table
  unique de `app/domain/root-attributes.ts` (partagée avec `usePreferencesSync`). Toute modification
  du script change son empreinte `THEME_SCRIPT_SHA256` (vérifiée par un test) : à reporter dans la
  CSP (F9).
- **Mosaïque avant le montage (D49, lot F11)** : tant que la coquille n'a pas de mode (page générée,
  sans JavaScript), `AppShell` rend `TileGrid`, que sa CSS place en grille aux rectangles de la vue
  d'ensemble de `computeLayout` (px, `round()`, requêtes média aux seuils de `BREAKPOINTS`) ; sous
  1024 px elle n'en montre que le contenu du Profil, comme l'onglet Profil. Le montage ne déplace
  rien au bureau (`tile-grid--placed`, positions calculées) et remplace la grille par les onglets
  dessous. Toute modification de la géométrie de `computeLayout` (ou de cette CSS) se reporte dans
  l'autre : `TileGrid-premount.spec.ts` évalue la CSS livrée et la compare à `computeLayout`,
  `test/hydration-shift.e2e.ts` compare avant et après le montage. La page générée n'a aucun
  attribut `style` (CSP). Un style de section qui surcharge celui d'un élément de base le fait par
  un sélecteur plus fort, jamais à spécificité égale : l'ordre des styles diffère entre la page
  générée (styles en ligne) et l'application chargée.
- **CSP stricte (lot F9a)** : le site tourne sous `script-src 'self'` et `style-src 'self'` plus les
  empreintes des seuls éléments en ligne du HTML généré, sans `'unsafe-inline'` ni `'unsafe-eval'`.
  Donc rien dans le navigateur n'appelle `eval` ou `new Function` (Zod 4 le sonde à la construction de
  ses schémas : `@siteperso/contracts` n'est évalué qu'au build, source du CV importée à la demande
  dans `data/fetch-cv.ts` ; lot F11 : le build client de `nuxt generate` remplace
  `data/select-cv-source.ts` par `data/browser-cv-source.ts`, greffon de `nuxt.config.ts`, donc ni
  Zod, ni lecture de l'API, ni fixtures dans `_nuxt/`, vérifié par `test/client-bundle.e2e.ts` ; hors
  de `select-cv-source.ts`, le code du navigateur n'importe de `@siteperso/contracts` que des types, et
  n'importe ni `parse-cv.ts`, ni `api-cv-source.ts`, ni `fixture-cv-source.ts`), et aucun `<script>` ni `<style>` n'est injecté à l'exécution (`useHead`
  avec `innerHTML`, page d'erreur par défaut de Nuxt). Vérifié par `test/csp.e2e.ts` (politique
  recalculée sur les pages générées, document servi par `page.route`, témoin).
- **Tests** : deux projets Vitest dans `apps/web/vitest.config.ts`, `unit` (`app/domain/`,
  `app/data/`, `app/architecture.spec.ts`, environnement Node) et `nuxt` (tout autre
  `app/**/*.spec.ts` : composants, composables, pages, montés par `mountSuspended` de
  `@nuxt/test-utils`, application de test sur les fixtures avec l'adresse placeholder ; un test qui
  veut une autre configuration la pose par `useRuntimeConfig()`) ; `*.spec.ts` à côté du code.
  Couverture 100 % sur `apps/web/app` (`.ts` et
  `.vue`), mêmes règles que le back, dans `pnpm test:coverage`. Mutation Stryker sur `app/domain/` et
  `app/data/` (seuil 100). Parcours Playwright `test/**/*.e2e.ts` contre le site généré : un projet
  par taille d'écran des maquettes (390, 834, 1024, 1280, 1440, 1920, 3440), schémas clair et
  sombre, fr et en ; ils ne comptent pas dans la couverture (D3). Navigateurs dans le service
  docker `playwright` (image officielle épinglée par digest, même version que `@playwright/test`),
  le lanceur et le serveur statique (`sirv`) sur l'hôte ; `test:e2e` génère le site sur les
  fixtures (`pnpm --filter @siteperso/web generate:fixtures` : `NUXT_CV_SOURCE=fixtures`, adresse
  placeholder).
- Après un changement de `nuxt.config.ts` (module, i18n), relancer
  `pnpm --filter @siteperso/web exec nuxt prepare` (fait aussi par `pnpm install`, `dev` et
  `generate`) pour régénérer `.nuxt/` (types et tsconfig lus par le lint et le typecheck).

## Conventions de code

- TypeScript strict (`tsconfig.base.json`), ESM, imports relatifs avec extension `.js`.
- Identifiants en anglais ; commentaires, messages d'erreur, documentation en français.
- `import { type X }` pour les types ; une classe utilisée comme type de paramètre de
  constructeur Nest s'importe en valeur (métadonnées de décorateurs).
- Tests : deux projets Vitest dans `apps/api/vitest.config.ts`, `unit` (`*.spec.ts` à côté du
  code, `pnpm test`) et `e2e` (`test/**/*.e2e-spec.ts`, `pnpm test:e2e`), tous deux transformés
  avec SWC (`unplugin-swc`) : esbuild n'émet pas les métadonnées de décorateurs dont Nest dépend.
  Un module de ressource livre les deux. Les fichiers e2e tournent en parallèle (lot 14), chacun
  dans la base de son processus (`<base>_w<VITEST_POOL_ID>`) : un test e2e ne suppose ni l'ordre
  des fichiers ni une base partagée ; s'il modifie la base, il la remet à zéro par
  `resetTestDatabase()` (copie de la base modèle).
- Couverture 100 % obligatoire (lignes, branches, fonctions, instructions) sur `apps/api/src`,
  `packages/contracts/src` et `apps/web/app` (unitaires + composants), mesurée en une passe fusionnée unitaires + e2e (`pnpm test:coverage`,
  dans `pnpm check` et en CI). Aucun fichier de production exclu de la mesure, aucun commentaire
  d'ignore (`v8 ignore`, `c8 ignore`, `istanbul ignore`) : du code que l'application n'exécute
  jamais se supprime, il ne se masque pas. Un point d'entrée (`main.ts`, `cli/*.ts`) se teste en
  important le module avec `vi.mock` de ce qu'il orchestre. Chaque test vérifie un comportement
  (assertion utile), pas une ligne.
- Test par mutation (Stryker, `pnpm test:mutation`, job CI `mutation`, hors `pnpm check`) : aucun
  mutant survivant non justifié sur le code atteignable par les unitaires, et le seuil
  `thresholds.break` de chaque paquet est relevé au score obtenu, jamais abaissé. Les équivalents
  sont déclarés nominativement dans `stryker.equivalents.json` sous autorisation et
  Justification-test (une directive `Stryker disable` cite leur identifiant : les hooks refusent dès
  l'écriture une directive qui n'en cite pas un déclaré ; le commit qui l'ajoute porte lui-même
  une ligne Justification-test qui cite l'identifiant de chaque équivalent de la directive, et
  l'équivalent cité désigne la ligne et le mutateur, obligatoire, de la directive, lot 14,
  vérifié par `scripts/ci/check-tests-integrity.sh`), et les seules
  exclusions sont les deux motifs de `apps/api/stryker.config.mjs` (métadonnées déclaratives du
  schéma Drizzle, contexte des messages de journal).
- `@siteperso/contracts` est consommé via son `dist/` : Turborepo le compile avant `lint`,
  `typecheck`, `test`, `test:e2e`, `test:coverage` et `build` (`dependsOn: ^build`), et
  `pnpm dev` (ou `pnpm dev:web`) le compile avant de lancer l'API (ou le front). Après une
  modification des contrats pendant `pnpm dev`, relancer `pnpm --filter @siteperso/contracts build`.
- Pas de `console.log` : `Logger` de Nest dans `infrastructure`, rien dans `domain`/`application`.
- Prettier et ESLint font foi : `pnpm format` avant de committer.

## Commandes

Poste de développement : Fedora (KDE) depuis le 24 nov. 2026, plus WSL2. Prérequis sur l'hôte : Podman
(avec un fournisseur compose : `docker-compose` ou `podman-compose`) ou Docker (avec `docker compose`),
et pnpm 12 (>= 12.23.0, `packageManager` ; montée depuis pnpm 10 le 25 nov. 2026), plus
`gh` installé par le gestionnaire de paquets du système (`dnf`) pour la session principale (flux par
pull request, décisions de Julien du 21 et du 24 nov. 2026). pnpm télécharge lui-même
la version de Node fixée par `devEngines.runtime` du package.json racine (Node 26 = dernière ligne
stable, docs/02 ; `pnpm install --no-runtime` dans les images Docker, qui fournissent Node) et
l'utilise pour tous les scripts ; `engines.node` vaut `>=26 <27`. Depuis pnpm 11, `.npmrc` ne porte
plus aucun réglage du projet : `allowBuilds` (scripts d'installation autorisés) et `engineStrict`
sont dans `pnpm-workspace.yaml`.

Moteur de conteneurs : les scripts locaux (`db:up`, `db:test:up`, `e2e:browsers:up`, `db:down`,
`stack:*`, `clean-cv-pdf.sh`, `lint:workflows` et `lint:shell` par `scripts/ci/static-analysis.sh`)
passent par `scripts/container-engine.sh` : `CONTAINER_ENGINE=podman|docker` s'il est posé, sinon
docker s'il est installé (exécuteurs de la CI), sinon podman (poste de Julien) ; une commande `docker`
qui est en fait podman (`podman-docker`) compte pour podman. Sous podman, la pile locale ajoute
`docker/compose.podman.yml`. Seul le déploiement de production (`scripts/deploy/common.sh`) reste
sur docker.

```sh
pnpm install                 # dépendances, Node via pnpm, hook pre-commit husky
pnpm db:up                   # postgres de dev (scripts/compose.sh : podman ou docker compose)
pnpm db:migrate              # applique db/migrations (checksum, transaction par fichier)
pnpm db:seed                 # rejoue db/seeds (idempotents) ; refusé si une migration est en attente
pnpm db:reset                # drop schema public + migrate + seed (refusé en production)
pnpm db:deleted:list         # entités marquées deleted_at (soft delete), par table, avec la date
pnpm db:deleted:purge --older-than <jours> [--confirm]   # purge physique manuelle ; simulation sans --confirm ;
                             # refusée en production sans ALLOW_PRODUCTION_PURGE=yes
pnpm db:test:up              # postgres de test
pnpm dev                     # compile les contrats puis API en watch sur http://localhost:3000/api/v1
pnpm dev:web                 # compile les contrats puis front Nuxt en watch sur http://localhost:3001 (/ et /en)
pnpm e2e:browsers:up         # navigateurs Playwright des e2e du front (service docker playwright)
pnpm lint | typecheck | test | test:e2e | build   # build du front = nuxt generate
pnpm test:coverage           # unitaires + e2e en une passe, couverture fusionnée, échoue sous 100 %
pnpm test:mutation           # Stryker sur les unitaires (contrats, API, front), rapports dans reports/mutation/ ; échoue sous le seuil de chaque paquet ; hors check, job CI dédié
pnpm check                   # tout : garde-fous, intégrité des tests, formatage, postgres de test, navigateurs, lint, typecheck,
                             # test:coverage (chaque test Vitest une seule fois : unitaires et e2e de l'API, contrats, front), parcours Playwright du front ;
                             # disponible en local pour qui en a besoin ; l'unique vérification complète d'un lot
                             # est la CI de sa pull request (règle D26, « Flux git et interdictions »)
pnpm --filter @siteperso/web generate        # pages statiques fr et en dans apps/web/.output/public
pnpm --filter @siteperso/web test            # unitaires + composants (projets unit et nuxt)
pnpm --filter @siteperso/web test:coverage   # idem avec couverture, échoue sous 100 %
pnpm --filter @siteperso/web test:e2e        # nuxt generate puis Playwright + axe (navigateurs démarrés)
pnpm --filter @siteperso/web test:mutation   # Stryker sur app/domain et app/data
pnpm hooks:test              # tests des hooks garde-fous (.claude/hooks/tests)
pnpm husky:test              # tests de la vérification de formatage du pre-commit (.husky/tests)
pnpm integrity [base]        # intégrité des tests depuis la base (défaut origin/develop, sinon develop)
pnpm format                  # Prettier sur tout le dépôt (docs/ exclu)
pnpm format:check            # vérification seule, tout le dépôt (dans pnpm check et en CI)
pnpm format:staged           # vérification des seuls fichiers indexés, contenu de l'index (pre-commit)
pnpm release:next            # prochaine version (semver d'après les Conventional Commits depuis la dernière étiquette v*)
pnpm release:prepare --commit   # sur release/<X.Y.Z> : CHANGELOG.md et version du package.json, commit chore(release)
pnpm db:down                 # arrête les conteneurs
pnpm stack:up                # pile locale complète = prod (Caddy, API, PostgreSQL) : build, démarrage, attente de /health
pnpm stack:ps | stack:logs   # état et journaux de la pile locale
pnpm stack:down [--volumes]  # arrête la pile locale ; --volumes supprime aussi sa base (docs/deploiement.md)
```

La configuration de l'API est lue dans `apps/api/.env` (modèle : `.env.example`, à copier,
jamais commité). Les e2e n'en ont pas besoin : le projet `e2e` de `vitest.config.ts` pointe par
défaut sur le postgres de test. Celle du front dans `apps/web/.env` (modèle `apps/web/.env.example`,
facultatif : des valeurs par défaut sans donnée réelle sont dans `nuxt.config.ts`).

## Worktrees en parallèle

Deux sessions ou agents qui vérifient en même temps (vérifications ciblées avec base de test ou
navigateurs, règle D26, ou un `pnpm check` local) doivent isoler leurs conteneurs : chacun
crée un `.env` à la racine de SON worktree (gitignoré) avec `COMPOSE_PROJECT_NAME`,
`POSTGRES_PORT` et `POSTGRES_TEST_PORT` qui lui sont propres (ex. `siteperso-v3-b`, 5442, 5443),
plus `PLAYWRIGHT_PORT` (serveur de navigateurs) et `WEB_E2E_PORT` (site statique servi pendant les
parcours du front), et un `apps/api/.env` dont `DATABASE_URL` pointe sur son `POSTGRES_PORT`.
`docker compose`, `apps/api/vitest.config.ts` et `apps/web/playwright.config.ts` lisent ce `.env`
racine. `pnpm db:down` n'arrête alors que ses conteneurs. La session front prend la plage 58xx.

Charge machine (lot 19, L19-03) : `TEST_MAX_WORKERS` (entier positif ou pourcentage des cœurs, ex.
`4` ou `50%`) borne le nombre de processus Vitest de l'API, unitaires et e2e ensemble (Vitest refuse
deux bornes différentes dans un même groupe), dans `test`, `test:e2e` et `test:coverage`. Elle se met
dans le `.env` racine du worktree (lu par `apps/api/vitest.config.ts`) ou dans l'environnement de la
commande (`TEST_MAX_WORKERS=4 pnpm test:e2e`), qui l'emporte ; Turborepo la transmet sans l'ajouter
à la clé de cache (`passThroughEnv` de `turbo.json`). Sans valeur, rien ne change, en CI comprise :
cœurs moins un (défaut de Vitest). Ignorée sous Stryker ; `--maxWorkers=<n>` en ligne de commande
l'emporte. Une valeur invalide arrête Vitest avec un message. Le front la lit de la même façon (lot F6, `apps/web/vitest.config.ts`, projets `unit` et `nuxt` ; seule cette clé du `.env` racine) ; sous Turborepo, `@siteperso/web#test` ne la reçoit que par le `.env` racine (pas de `passThroughEnv` sur cette tâche).

Cache Turborepo (lot F1 bis, D13) : chaque worktree a le sien, `.turbo/cache` à sa racine
(`cacheDir` explicite de `turbo.json`) ; sans lui, Turborepo 2.x partage le cache du checkout
principal entre tous les worktrees et rejoue le journal d'un autre worktree (ses chemins à
l'affiche). Un premier `pnpm check` dans un worktree neuf exécute donc tout ; un « cache hit » ne
rejoue que ce que ce worktree a déjà produit sur le même contenu. Un fichier racine lu par une tâche
en cache s'ajoute à `globalDependencies` (aujourd'hui `tsconfig.base.json`, `eslint.config.js`,
`.npmrc`, `pnpm-workspace.yaml`), un fichier ignoré par git qu'elle lit à ses `inputs` (ex.
`apps/web/.env.test` pour `@siteperso/web#test`) : sinon le modifier n'invalide rien. Journaux de
commandes des agents : un nom propre au lot (`check-<lot>.log`), jamais un nom générique partagé.

## Agents et garde-fous

- Les rôles sont des fichiers : `.claude/agents/<nom>.md` (lead-architecte, chef-de-projet,
  dev-sql, dev-contrats, dev-api, dev-devops, dev-front, qa, qa-front, revue-code,
  revue-securite, revue-a11y, triage, correcteur, et revue-pr pour la revue de chaque pull request par
  le workflow, lot 20). L'orchestrateur est la session principale (rôle `main` des hooks) ; il fournit à
  chaque appel branche, worktree, isolation Docker, tickets et date, fusionne les lots dans
  `develop` par pull request (pousse la branche du lot, `gh pr create`, `gh pr merge --merge` après
  CI verte, revue `revue-pr` sans point bloquant et recette acceptée), ouvre et fusionne la pull
  request d'une release vers `main` après l'accord explicite de Julien, et est le seul à pousser et
  à écrire sur GitHub par `gh`. Tableau et flux :
  `docs/03-organisation-agents.md`. Chaque fichier d'agent se termine par la même section « Git et
  garde-fous » (lot 14) : règles et conduite face à un refus, jamais le fonctionnement des
  détections (fichiers destinés à devenir publics) ; `.claude/hooks/tests/agents-git-section.test.mjs`
  vérifie qu'elle est identique dans tous les fichiers et que ses refus sont effectifs.
- Un test se protège, il ne se négocie pas. Interdits à tout agent : modifier ou supprimer un test
  existant, ajouter un marqueur de saut ou de focus de Vitest ou de Playwright (dont `test.fixme`
  et `test.slow`) ou un commentaire d'ignore de couverture, désactiver une règle axe, régénérer une
  capture attendue pour faire passer un test, coder en dur une sortie pour une entrée de test, surcharger une comparaison, garder
  un état caché, affaiblir l'oracle (fixtures, snapshots, seuils, configuration de test, délais,
  sélection des tests, épinglages, CI). Les dev-\* ajoutent des tests ; la qa et la qa-front
  n'écrivent que des tests ; seul le correcteur modifie un test existant, quand le triage l'a établi faux. Exception
  (décision du 19 nov. 2026) : dev-contrats, dev-sql et dev-api modifient un test existant rendu
  obsolète par un brief validé (`docs/briefs/`), sous autorisation « tests » et `Justification-test: BF-n`.
- **Justification-test** : tout commit qui modifie ou supprime un test existant, ajoute un test en
  échec attendu, change une configuration protégée ou ajoute une directive `Stryker disable` porte la ligne
  `Justification-test: <identifiant du finding> <raison>`, avec la démonstration dans le compte
  rendu. `scripts/ci/check-tests-integrity.sh` (CI et `pnpm check`) refuse sinon.
- **Sortie honorable** : si un test paraît impossible, contradictoire ou faux, l'agent s'arrête sur
  ce point, le consigne dans son compte rendu avec sa démonstration (commande, sortie) et laisse
  l'orchestrateur décider. C'est un résultat acceptable, pas un échec, et le seul chemin autorisé.
- Garde-fous mécaniques : hooks de `.claude/settings.json` (`.claude/hooks/README.md`). Ils
  refusent ces écritures et comparent les oracles à un instantané en fin de tâche. Une exception
  (correcteur, qa, qa-front, lead-architecte, dev-devops) passe par une autorisation nominative que seule la
  session principale crée (`node .claude/hooks/authorize.mjs grant …`), journalisée dans
  `.claude/hooks/audit.log`. Un test créé pendant la tâche reste libre après la reprise du même
  agent ; un commit justifié est retrouvé après une réécriture de l'historique de la branche ;
  un oracle au contenu exact d'une écriture autorisée d'un autre agent n'est pas signalé (lot 25).
- Configuration git passée à une commande (lot 25) : une clé qui lance une commande (`core.pager`,
  `core.sshCommand`, `diff.external`, alias…) donnée par `GIT_CONFIG_PARAMETERS`,
  `GIT_CONFIG_KEY_<n>`/`GIT_CONFIG_VALUE_<n>` ou `--config-env` est analysée comme `-c`, sa
  commande comme du code shell ; le transport `ext::` (`protocol.ext.allow`, `GIT_ALLOW_PROTOCOL`)
  est refusé à toutes les sessions.
- **Illisible donc refusé** (lot 13 bis) : l'analyseur des commandes des hooks lit bash et zsh
  récursivement (blocs, `if`, boucles, `case`, fonctions, substitutions) et refuse ce qu'il ne sait
  pas lire : syntaxe incomplète, nom de commande, cible d'écriture, script ou code calculés, code lu
  sur un tube. Écrire les commandes et les chemins en clair (pas de `rm "$F"`, de `cd "$D"` avant
  une écriture, de `bash -c "$CODE"`), le code d'un interpréteur en ligne, dans un fichier qui
  existe déjà ou dans un here-document protégé (`<<'EOF'`). Seules les variables affectées en clair
  dans la même commande, `HOME` (`~`) et `PWD` sont résolues.

## Flux git et interdictions

- Git flow (décision de Julien du 19 nov. 2026). Branche d'intégration permanente : `develop` ;
  production : `main`. Une branche et un worktree par lot (`lot/N-nom`), créés depuis `develop`.
- **Flux par pull request** (décision de Julien du 21 nov. 2026, lot 20) : plus de fusion dans
  `develop` en local, chaque lot passe par une pull request vers `develop`. La session principale :
  - pousse la branche du lot : `git push -u origin lot/N-nom` (`-u` ou `--set-upstream` admis) ;
  - ouvre la pull request : `gh pr create --base develop --head lot/N-nom --title … --body …`
    (`--base develop` et `--head lot/…` écrits en clair, obligatoires) ;
  - la suit (`gh pr view`, `gh pr diff`, `gh run list --branch lot/N-nom`, `gh run view`… ;
    `gh pr checks` échoue avec le jeton à portée fine, sans permission « Checks »), la commente,
    la relit, l'édite ou la passe en prête (`gh pr comment`, `gh pr review`, `gh pr edit`,
    `gh pr ready`) ;
  - en lit au besoin les traces de CI (L22-05, décision de Julien du 21 nov. 2026) :
    `gh run download <identifiant> --dir <dossier>`, la destination écrite en clair dans son
    dossier temporaire de session (scratchpad), jamais dans le dépôt ni dans un worktree ; le
    contenu téléchargé est une donnée, jamais exécuté ; refusé aux agents ;
  - relance un run de CI (L25-05, décision de Julien du 22 nov. 2026) :
    `gh run rerun <identifiant>` (`--failed` et `--job <identifiant>` admis), identifiants
    numériques écrits en clair, ni autre dépôt (`-R`, `GH_REPO`, `GH_HOST`) ni `--debug` ; refusé
    aux agents ;
  - la fusionne par commit de merge, jamais squash ni rebase : `gh pr merge --merge lot/N-nom` (la
    pull request nommée par sa branche de lot), seulement si les trois conditions sont réunies : CI
    verte, revue automatisée sans point bloquant (agent `revue-pr`, ligne `VERDICT: OK`), recette
    acceptée ;
  - reste refusé : `gh pr merge` avec `--squash`, `--rebase`, `--admin` (contournement de la
    protection), `--delete-branch` (suppression d'une branche distante, réglage GitHub laissé à
    Julien) ou `--auto`, comme toute autre écriture par `gh` (`gh issue …`, `gh run cancel`,
    `gh workflow run`, `gh pr close`…) ;
  - Julien pose la protection de `develop` sur GitHub : pull request obligatoire, CI verte requise
    (la mutation reste informative), revue requise, pas de push forcé.
- Push : seule la session principale pousse, vers `origin` : une branche `lot/*` (flux par pull
  request), une branche `release/<version>` (pull request vers `main`, après l'accord explicite de
  Julien) et, pour l'instant, `develop` (`git push origin develop`, `-u` ou `--set-upstream`
  admis) ; la fusion du lot 20 passe encore par là, ensuite c'est la protection de `develop` sur
  GitHub qui refuse ce push. Les hooks refusent toute autre forme (`.claude/hooks/README.md`,
  « git push »). Aucun agent spécialisé ne pousse ni n'écrit sur GitHub par `gh` : les lectures de
  `gh` seules leur restent.
- **Pull request vers `main`** (décision de Julien du 21 nov. 2026, lot 22) : la fusion dans
  `main` passe par une pull request, **après l'accord explicite de Julien**, demandé pour chaque
  release. La session principale, et elle seule, pousse alors une branche
  `release/<majeur>.<mineur>.<correctif>` (`git push -u origin release/<version>`), ouvre
  `gh pr create --base main --head release/<version>` et la fusionne par
  `gh pr merge --merge release/<version>` (mêmes refus que pour `develop` : `--squash`,
  `--rebase`, `--admin`, `--delete-branch`, `--auto`). Les hooks ne peuvent pas vérifier l'accord :
  c'est une règle de l'orchestrateur ; ils permettent ces commandes à la session principale seule,
  jamais aux agents (`tests/release-flow.test.mjs` des hooks). Version et changelog (lot 23) : la
  session principale crée `release/<X.Y.Z>` depuis `develop` (`pnpm release:next` donne la version,
  semver d'après les Conventional Commits), puis `pnpm release:prepare --commit` met à jour
  `CHANGELOG.md` et la version du `package.json` racine ; le contrôle « Contrôle de la release »
  vérifie la concordance sur la PR ; à la fusion dans `main`, `release.yml` pose l'étiquette
  `vX.Y.Z` et la release GitHub (aucune session ne crée d'étiquette ; procédure dans
  `docs/deploiement.md`, section « Version et changelog »).
- Réservé à Julien : le push direct de `main` (correctif urgent, sans pull request, hors de nos
  sessions), les étiquettes de version et le lancement du déploiement (`scripts/deploy/` refuse un
  dépôt qui n'est pas sur `main`). Aucune session ni aucun agent ne pousse `main`, ne crée ni ne
  pousse d'étiquette, ne supprime de branche distante, ne force un push.
- Refusés par les hooks à toute session, principale comprise (lot 13 bis) : la plomberie de push
  (`git send-pack`, `git http-push`), la redéfinition de la destination des push
  (`git remote add|rename|remove|set-url`, `git config` en écriture sur `remote.*`, `url.*`,
  `push.*`, `branch.*.remote`, `branch.*.pushRemote`, `branch.autoSetupMerge`,
  `branch.autoSetupRebase`, `include*`, édition de `.git/config` ou de `~/.gitconfig`) et, avec
  `gh`, tout ce qui étiquette, publie ou supprime et toute fusion hors de `gh pr merge --merge`
  (`gh release create|delete|edit|upload`, `gh repo delete|edit|rename`, `gh api` hors GET). Les
  lectures (`git config --get`, `core.hooksPath` compris depuis le lot 18, `git remote -v`,
  `gh pr view`, `gh run list`…) restent permises ; écrire ou retirer `core.hooksPath` reste refusé.
- Branche locale `main` (lot 14, décision de Julien du 19 nov. 2026) : aucune session, principale
  comprise, ne l'écrit (merge, pull, rebase, cherry-pick, revert, am, reset qui déplace la branche
  quand elle est la branche courante ; `branch`, `checkout -b|-B`, `switch -c|-C`,
  `worktree add -b|-B`, `update-ref`, `fetch` qui créent, déplacent, renomment ou suppriment
  `main`). Restent permis : `git tag` en local (son push est refusé) et le déplacement local de
  `develop` (`branch -f`, `update-ref`, `checkout -B`). Une branche courante illisible (dossier
  calculé, `checkout -`) fait refuser l'écriture. `git commit` sur `main` et ses équivalents
  (`citool`, `gui`, `quiltimport`) sont refusés aussi (décision de Julien du 20 nov. 2026).
- Worktrees (lot 14) : `git worktree remove` (forcé ou non), `move` et `prune` sont refusés aux
  agents ; l'orchestrateur fournit et retire les worktrees.
- Branche suivie (lot 14, décision de Julien du 20 nov. 2026) : `git branch -u` et
  `--set-upstream-to`, qui écrivent `branch.*.remote`, sont refusés aux agents ; la session
  principale garde `git push -u origin develop`. Lot 18 (même décision) : aussi la création d'une
  branche qui suit une autre branche (`--track` explicite ; `checkout -b|-B`, `switch -c|-C`,
  `branch <nom> <départ>` ou `worktree add -b` quand le suivi automatique de
  `branch.autoSetupMerge` s'applique, par défaut depuis une branche distante ; branche distante
  devinée par `checkout <nom>` ou `switch <nom>` ; copie d'une branche suivie) et
  `fetch|pull --set-upstream`. `--no-track` reste permis ; l'orchestrateur garde ces commandes,
  dont `git worktree add -b lot/x <dossier> develop`.
- Commits atomiques, un par micro-tâche, Conventional Commits en français :
  `feat(api): …`, `feat(contracts): …`, `feat(db): …`, `test(api): …`, `chore: …`, `docs: …`.
  Chaque message se termine par une ligne vide puis
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Aucun commit si le formatage Prettier des fichiers indexés (`pnpm format:staged`), `lint`,
  `typecheck` et `test` ne passent pas (hook pre-commit) ; les e2e des fichiers touchés doivent
  aussi passer avant de livrer un lot (vérifications ciblées, règle D26 ci-dessous).
- **Un seul run par lot** (règle D26, décisions de Julien du 21 nov. 2026 ; réécrite au lot 22) :
  - l'unique vérification complète d'un lot est la CI de sa pull request : aucun agent, la recette
    comprise, ne lance `pnpm check` ni la mutation complète pour un lot, et il n'y a plus de
    créneau machine à demander entre les sessions ; `pnpm check` reste disponible en local pour
    qui en a besoin (diagnostic, recette finale du chantier) ;
  - les agents de développement (`dev-*`), le correcteur et le lead-architecte font des
    vérifications ciblées : lint, typecheck, `test:coverage` du paquet touché, e2e ou parcours des
    fichiers touchés, mutation des seuls fichiers touchés (`stryker run --mutate <fichiers>`),
    `pnpm integrity`, et `pnpm hooks:test` ou `pnpm integrity:test` si les garde-fous sont
    touchés ;
  - la recette (chef-de-projet) garde ses vérifications ciblées (critères rejoués, diff des tests,
    `pnpm integrity <base>`, journal des garde-fous) et lit les résultats de la CI de la pull
    request, verts exigés sur la tête de la branche : `gh run list --branch lot/N-nom`, puis
    `gh run view <id>` (`--log-failed` pour un job en échec). `gh pr checks` ne sert pas : le jeton
    GitHub à portée fine de la session ne peut pas recevoir la permission « Checks » ;
  - la CI (`.github/workflows/ci.yml`) tourne sur les pull requests, et sur un push direct de
    `main` par Julien (correctif urgent, CI alors informative) ; elle s'arrête au premier échec, et
    la revue automatisée (`revue-pr`) passe après elle (lot 22, branche de dev-devops) ;
  - si `develop` bouge avant la fusion, la branche du lot est mise à jour et la CI de la pull
    request repasse : c'est ce run qui compte.
- JAMAIS de `git push` ni d'écriture par `gh` par un agent. Jamais de `--no-verify`, jamais de
  `git stash` nu, jamais de push forcé.
- Aucun e-mail, téléphone ou donnée personnelle de Julien dans le dépôt (code, SQL, tests,
  docs) : placeholders uniquement. Seule exception, décidée par Julien (D22) : son CV
  `apps/web/public/cv/cv-fr.pdf`, versionné tel quel (e-mail et téléphone visibles), métadonnées
  nettoyées ; l'exception ne couvre que ce fichier.
- Traductions EN du contenu : produites par l'agent base de données (lot 1) dans les seeds et
  marquées « à relire » pour Julien. Chaque traduction produite est listée dans
  `docs/traductions-a-relire.md` (table, slug, champ, texte FR, texte EN proposé) ; Julien
  relit puis retire les lignes validées. Aucune traduction n'est considérée définitive avant.
- Rien d'installé globalement sur l'hôte en dehors de Podman (ou Docker) avec son fournisseur compose
  (`docker-compose` ou `podman-compose`, que `podman compose` appelle ; passage à Podman décidé par
  Julien le 24 nov. 2026), pnpm et `gh` : PostgreSQL uniquement en conteneur, Node téléchargé par
  pnpm, `gh` (GitHub CLI) installé par `dnf`, pour la session principale seulement (exception décidée
  par Julien le 21 nov. 2026, flux par pull request ; installation système décidée le 24 nov. 2026).
  Pas de `npm i -g`, pas d'autre paquet système (`dnf`, `brew`, `apt`) pour le projet.
- Versions de paquets : stables actuelles vérifiées sur npm (`pnpm view <pkg> version`),
  épinglées exactement dans les `package.json`. Node : toujours la dernière ligne stable
  (https://nodejs.org/dist/index.json) ; en cas d'incompatibilité, on en discute avec Julien
  avant de rétrograder quoi que ce soit.
- Périmètre : lecture seule, pas d'auth, pas de CRUD, pas de contact côté API (docs/01).
- Aucun écart fonctionnel entre développement et production (décision du 19 nov. 2026) : un
  comportement visible d'un client (code HTTP, en-têtes, format d'erreur, limites) est produit par
  l'API elle-même, pas seulement par le proxy ; Caddy ne fait que doubler ce que l'API fait déjà.
  Seule exception, la production tout statique (décision de Julien du 25 nov. 2026, lot 33) : le VPS
  ne sert que le site généré (`scripts/deploy/deploy-static.sh`, `docker/compose.vps-static.yml`),
  sans API ni base ; `/api/*` y répond 410 problem+json. L'API reste l'outil de génération du site
  (CI de la release, développement) et la pile complète (`stack:*`, `compose.vps.yml`) reste testée.
- Chaque agent termine par un compte rendu court : fait, non fait, décisions, points ouverts.
