# Lot F9a : front compatible avec une CSP stricte (lead-architecte)

Date : 22 novembre 2026. Branche `lot/F9a-csp` (worktree `.claude/worktrees/lot-F9a-csp`), depuis `develop` (9f66ac8).
Isolation : `.env` racine `siteperso-v3-f9a`, 5872/5873, `PLAYWRIGHT_PORT=5874`, `WEB_E2E_PORT=5875`. Règle D26 :
vérifications ciblées. Rien dans `apps/api`, `db`, `packages/contracts`, `docker/`, `scripts/deploy/`. Aucun test
existant modifié, aucune configuration protégée touchée. Journaux : dossier temporaire de la session, préfixe `f9a-`.

## Reproduction

Hors dépôt : `generate:fixtures`, un serveur Node qui sert `.output/public` comme Caddy (`{path}`,
`{path}/index.html`, sinon `404.html` en 404) avec l'en-tête de `csp-hashes.mjs` (copié de `lot/24-service-front`),
et une sonde Playwright (`securitypolicyviolation` avec fichier, ligne, colonne ; console ; réponses en erreur). Les
violations du lot back 24 sont reproduites à l'identique sur `/`, `/en`, `/accessibilite`, `/en/accessibilite`,
`/route-inconnue`, `/en/route-inconnue`.

## Cause de chaque violation

| Constat | Cause, avec preuve | Correction |
|---|---|---|
| 1. `script-src` bloque `eval`, sur chaque page (`_nuxt/55kBDpoX.js:1:2460`) | **Zod 4** : `util.allowsEval` sonde `new Function("")` dans un `try` (zod 4.6.7, `v4/core/util.js:218`), appelé à la **construction** de chaque `z.object` (`v4/core/schemas.js:1195`, `fastEnabled = jit && allowsEval.value`). Une exception attrapée produit quand même une violation. Les schémas des contrats et les fixtures étaient évalués dans le navigateur : `fetch-cv.ts` importait `select-cv-source.js` (donc `ApiCvSource`, `parse-cv`, `@siteperso/contracts`, fixtures) en statique. La colonne 2460 du chunk tombe sur `try{return Function(\`\`),!0}catch{return!1}` | `fetch-cv.ts` : le gestionnaire de `useAsyncData` (exécuté au build seulement ; dans le navigateur la donnée vient de la charge utile) importe la source **à la demande**. Le chunk Zod (138 ko) n'est plus évalué, seulement préchargé (`rel="prefetch"`, sans effet CSP). Commit 17ef0a7 |
| 2. `style-src-elem` et `script-src-elem` bloquent un `<style>` et un `<script>` injectés (`_nuxt/C55RxtbE.js`), page 404 seulement | **Page d'erreur par défaut de Nuxt** (`nuxt/dist/app/components/error-404.vue`, l. 29-41) : son `useHead` injecte un `script` et un `style` `innerHTML`. Les empreintes bloquées du journal du lot 24 sont exactement celles de ces deux textes (`sha256-Obm/pgvN…` et `sha256-Vltw0WmW…`, recalculées sur le fichier). `404.html` était une coquille vide (`data-ssr="false"`) : tout était rendu dans le navigateur. Ni le script de thème ni unhead ne réinjectent rien sur les autres pages (aucune violation `-elem` ailleurs) | `app/error.vue` (provisoire, contenu en F7-01) : titre, explication, retour à l'accueil ; 404 ou erreur générique ; fr et en (`error.*` dans `common.json`) ; aucun élément injecté, styles dans la feuille du composant. Commit 1ae2f9d |
| 3. Ressource en 404 puis `[NUXT_E1005]` | Deux choses distinctes. « Failed to load resource : 404 » est **le document lui-même** (`/route-inconnue` répond 404 : statut voulu, le navigateur le journalise toujours). `NUXT_E1005` (« Error caught during app initialization », `nuxt/dist/app/nuxt.js:112`) : dans la coquille vide, `router.afterEach` appelle `showError(404 « Page not found »)` pendant l'initialisation (`pages/runtime/plugins/router.js:232`). Ni un `_payload.json` manquant, ni une suite de 1/2 | `experimental.prerenderErrorPages: true` (Nuxt 4.6, `@nuxt/schema`) : `404.html` est **rendu au build** avec la page d'erreur ; l'erreur est dans la charge utile, le routeur ne la relève plus (`!error.value`), plus de `NUXT_E1005`. Le rendu est en français et sert aussi `/en/...` : la page hydrate avec les textes du rendu (`useState`), puis passe à la langue de l'adresse une fois montée ; sans cela, « Hydration completed but contains mismatches » (constaté, les libellés fr ne sont pas chargés dans le navigateur sous `/en`) |

Résultat (sonde hors dépôt, après les deux commits) : aucune violation et aucune erreur de console sur les six
adresses, hors la ligne « Failed to load resource : 404 » du document des deux adresses inconnues ; `lang`, `h1`,
`main#contenu`, `data-theme` corrects partout (fr et en pour la 404).

## Parcours permanent `test/csp.e2e.ts`

Politique recalculée par une fonction locale équivalente à `csp-hashes.mjs` (mêmes expressions, mêmes directives),
sans dépendance à `scripts/deploy/`. `sirv` ne pose pas d'en-tête, mais **aucune configuration n'est à changer** : le
document est servi par `page.route` depuis `.output/public` avec l'en-tête CSP, selon les règles de Caddy ; les
autres ressources viennent de `sirv`. Neuf tests aux sept tailles : six adresses (statut, `lang`, `h1`,
`main#contenu`, `data-theme` posé par le script de thème, axe WCAG 2.2 AA, zéro violation, zéro erreur de console
hors le statut 404 du document), deux navigations dans l'application (sélecteur de langue, `/` ↔ `/en` : charge
utile et libellés chargés sous `connect-src 'self'`), un témoin (politique sans empreintes : violations
`script-src-elem` et `style-src-elem` relevées, donc l'en-tête est appliqué et l'oracle mord).

Commit 85c6275. Contre-preuve : avec `fetch-cv.ts` et `nuxt.config.ts` de 9f66ac8 et sans `error.vue`, le même parcours échoue
(8 échecs sur 9 à 1280 : `script-src bloque eval (…/55kBDpoX.js:1:2460)` sur les pages et les navigations, 404 sans
`lang`), puis tout repasse après restauration.

## Vérifications

| Vérification | Commande | Résultat |
|---|---|---|
| Lint | `pnpm --filter @siteperso/web lint` | 0 erreur, 0 avertissement |
| Types | `pnpm --filter @siteperso/web typecheck` | vert |
| Couverture | `pnpm --filter @siteperso/web test:coverage` | 97 fichiers, 998 tests ; 100 % (1177 instructions, 664 branches, 384 fonctions, 1051 lignes), `error.vue` et `fetch-cv.ts` à 100 % |
| Mutation | `pnpm --filter @siteperso/web exec stryker run --mutate app/data/fetch-cv.ts` | 23 tués, 0 survivant, score 100 |
| Mutant manuel | `shown` réduit à `texts()` dans `error.vue` | le test d'hydratation de `error.spec.ts` échoue, puis repasse |
| Parcours CSP | `playwright test test/csp.e2e.ts --workers=2` | 63/63 (7 tailles) |
| Parcours existants | `playwright test --workers=2 --project=mobile-390 --project=desktop-1280` | 310/310 (tous les parcours, dont `csp.e2e.ts`, aux deux tailles) |
| Intégrité | `pnpm integrity develop` | « Intégrité des tests : OK » (divergence 9f66ac8) |

## Ce que le back doit savoir (`csp-hashes.mjs`, `csp-smoke.mjs`, Caddy)

- **Aucune empreinte à ajouter à la main** et aucune directive à assouplir : `'unsafe-eval'` et `'unsafe-inline'`
  restent exclus. `csp-hashes.mjs` parcourt déjà tous les `.html` : `404.html` est maintenant une vraie page rendue
  (carte d'import, script de thème, `window.__NUXT__`, un `<style>`, `__NUXT_DATA__` en `application/json`), ses
  empreintes sont relevées comme les autres. La carte d'import (`type="importmap"`) doit rester hachée (le
  navigateur l'applique à `script-src`) : c'est déjà le cas.
- **`csp-smoke.mjs`** : pour la page 404, la ligne de console « Failed to load resource: the server responded with a
  status of 404 » est le statut du document lui-même (attendu) ; elle est à ignorer pour cette page seulement (le
  parcours du front ignore exactement ce message, sur l'URL du document). La 404 a maintenant `main#contenu` et
  `lang` (`fr` au premier affichage, `en` sous `/en/...` après hydratation) : `main: true` est possible.
- `connect-src 'self'` reste nécessaire (charge utile `_payload.json` et libellés `/_i18n/…/messages.json` lors d'une
  navigation dans l'application).
- `200.html` reste une coquille vide (repli SPA de Nuxt) : Caddy ne la sert pas, aucun effet.

## Décisions

- **Import à la demande plutôt que `z.config({ jitless: true })`** : `jitless` devrait être posé avant la
  construction des schémas, donc dans `packages/contracts` (périmètre back) ou par un ordre d'import fragile ; ne
  pas évaluer Zod dans le navigateur règle la cause et allège le client (le gestionnaire `useCv` embarqué était un
  point ouvert de F3a). Alternative écartée : un plugin client qui pose `jitless` (ordre non garanti).
- **404 rendue au build** plutôt que la coquille vide avec sa seule page d'erreur : sans rendu, `NUXT_E1005` reste en
  console à chaque 404 et la page est vide sans JS. Alternative écartée : une page `[...slug].vue` attrape-tout
  (statut 200 en dev, et elle change la sémantique des routes, F7-01).
- **`page.route` plutôt qu'un changement de `playwright.config.ts`** : aucun oracle de configuration touché ; le
  témoin prouve que l'en-tête est appliqué.

## Points ouverts

1. La 404 sous `/en/...` s'affiche en français jusqu'à l'hydratation (et sans JS) : une page par langue
   (`en/404.html`) demanderait une règle Caddy (`handle_errors` sous `/en/*`) et un rendu dédié ; à décider en F7-01.
2. Le chunk Zod reste **préchargé** (`<link rel="prefetch">`, 138 ko au repos du navigateur) sans être exécuté :
   sans effet sur la CSP ; le retirer (option de préchargement de Nuxt/Vite) est une optimisation à part.
3. `error.vue` est provisoire (contenu et mise en page en F7-01) ; la page d'erreur n'a pas le lien d'évitement
   (elle n'a pas de bloc répété).
