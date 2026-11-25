# Lot 30 : pages d'erreur 404 et 500 du front (lead-architecte)

Date : 25 novembre 2026. Branche `lot/30-pages-erreur` (worktree `personnalWebsite_V3-lot30`), depuis
`develop` (80b756b). Carte Trello 50. Isolation : projet compose `siteperso-v3-lot30`, PostgreSQL
5862/5863, Playwright 5820, site e2e 5821. Aucune configuration protégée touchée, aucun test existant
modifié, rien dans `apps/api`, `db`, `packages/contracts`. Règle D26 : vérifications ciblées seulement ;
conteneurs arrêtés (`pnpm db:down`) après chaque série de vérifications (consigne de Julien du jour).

## Fait

| Ticket | Livré |
|---|---|
| 404 (vérification) | `error.vue` (gabarit `annex`, `AnnexPage`) relu contre le handoff v6 : la SPEC ne dessine pas la 404 (COMPOSANTS.md, « États non dessinés ») ; elle reprend l'identité de SPEC § 1 (barre lilas `>_ erreur-404.log`, ombre verte décalée, Space Grotesk / JetBrains Mono, tokens des deux thèmes), en fr et en, avec deux retours à l'accueil (nom du site dans l'en-tête, lien « Retour à l'accueil »). Captures 390 et 1440 px, clair et sombre : conformes. Rien à compléter sans toucher un test existant (voir points ouverts, code visible). |
| 50x | Une page autonome par langue, `50x.html` et `en/50x.html`, générée avec le site : titre « Site indisponible pour l'instant » / « Website temporarily unavailable », message générique sans code ni détail, lien « Réessayer » (`href=""` : recharge l'adresse servie), retour à l'accueil, `noindex`, ni canonique ni hreflang, hors `sitemap.xml`, `lang` juste, en-tête réduit au lien du site (contrôles retirés : sans JavaScript, ils ne feraient rien). |
| Caddy (doc) | `docs/deploiement.md`, « Pages d'erreur serveur (lot 30, branchement au lot 32) » ; CLAUDE.md (référencement et pages annexes). |

### Mécanisme retenu

`/50x.html` et `/en/50x.html` sont ajoutées aux routes prérendues ; le routeur n'y trouve aucune page et
`error.vue` est rendue avec l'erreur 404 de cette adresse, qu'elle reconnaît par `error.data.path`
(champ que le routeur de Nuxt pose sur son 404, `pages/runtime/plugins/router.js`) via
`domain/server-error-page.ts`. Le hook `prerender:generate` de `nuxt.config.ts` garde la route malgré son
404 (comme `/en/404.html`) puis passe le HTML à `standaloneErrorPage` : tout `<script>` est retiré
(module d'entrée, carte d'import, `window.__NUXT__`, charge utile JSON) sauf le script de thème (contenu
exactement égal à `themeScript()`), ainsi que les `modulepreload` et préchargements de script ou de
charge utile. Restent les feuilles de style `/_nuxt/*.css`, les `<style>` en ligne (hachés comme ceux
des autres pages) et le préchargement de la police.

- **Pourquoi ce mécanisme** : mêmes composants, mêmes libellés et mêmes feuilles de style que le reste
  du site (aucune copie de styles ni de textes), aucune dépendance ajoutée, aucun effet sur les autres
  pages. Sans application, la page n'est jamais hydratée : servie à n'importe quelle adresse, elle ne
  bascule pas en 404 au démarrage de Nuxt (ce que ferait une page prérendue ordinaire).
- **Écartés** : la règle de route `noScripts` de Nuxt (elle ajoute un `<script type="speculationrules">`
  à toutes les autres pages et met les feuilles de style de la page en ligne, lu dans
  `nuxt/dist/runtime/server/renderer/index.js`) ; un greffon serveur comme
  `localized-error-page.server.ts` (les scripts sont ajoutés après `app:rendered`, il ne peut pas les
  retirer) ; un document HTML écrit à la main en fin de prérendu (styles et libellés à recopier, noms à
  empreinte des CSS à deviner) ; `useRoute().path` dans `error.vue` (dans l'environnement de test, le
  routeur ne navigue pas vers une adresse sans page : branche impossible à couvrir).
- **Script de thème gardé** : il est en ligne, haché dans la CSP, et ne lit que le stockage local et
  `matchMedia` : utilisable hors ligne. Il applique les réglages enregistrés (thème, contraste renforcé,
  taille du texte…), ce qui compte pour l'accessibilité. Sans JavaScript, la page suit
  `prefers-color-scheme` (repli de `tokens.css`), vérifié par le parcours.

### Chemins produits (pour le lot 32)

- `.output/public/50x.html` (fr) et `.output/public/en/50x.html` (en) ; en production
  `/srv/web/current/public/50x.html` et `/srv/web/current/public/en/50x.html`.
- Statut attendu : celui de l'erreur (500, 502, 503 ou 504), page servie **par réécriture** à l'adresse
  demandée (pas de redirection : « Réessayer » recharge l'adresse affichée), `en/50x.html` quand le
  chemin d'origine est `/en` ou commence par `/en/`, CSP du front (`csp.caddy`), `Cache-Control: no-cache`.
  `file_server { status {err.status_code} }` : la doc Caddy indique que `status` accepte les placeholders.
- Ressources demandées par la page : `/_nuxt/*.css` et `/fonts/**.woff2` seulement.

## Commits

1. `feat(web): pages d'erreur serveur autonomes (domaine)` : `app/domain/server-error-page.ts` + test.
2. `feat(web): gabarit annexe sans contrôles d'en-tête` : prop `controls` de `layouts/annex.vue` + test.
3. `feat(web): page d'erreur serveur dans error.vue (fr, en)` : `error.vue`, `common.json` fr/en + test.
4. `feat(web): prérendu des pages d'erreur serveur autonomes` : `nuxt.config.ts` + `test/server-error.e2e.ts`.
5. `docs: pages d'erreur serveur (CLAUDE.md, déploiement, compte rendu du lot 30)`.

## Vérifications

| Critère | Commande | Résultat |
|---|---|---|
| Unitaires du domaine | `vitest run --project unit app/domain/server-error-page.spec.ts` | 10/10 |
| Composants | `vitest run --project nuxt app/error-server.spec.ts app/error.spec.ts app/i18n-messages.spec.ts app/i18n-hardcoded.spec.ts app/layouts` | 25/25 |
| Couverture | `pnpm --filter @siteperso/web test:coverage` | 127 fichiers, 1157 tests ; 100 % (1449/1449 instructions, 785/785 branches, 467/467 fonctions, 1290/1290 lignes) |
| Mutation | `pnpm exec stryker run --mutate app/domain/server-error-page.ts` (apps/web) | 100 % (57 tués, 0 survivant) |
| Lint, typecheck | `pnpm --filter @siteperso/web lint`, `typecheck` | code 0 |
| Génération | `pnpm --filter @siteperso/web generate:fixtures` | `50x.html` et `en/50x.html` : un seul `<script>` (thème), deux feuilles de style, préchargement de police ; `sitemap.xml` sans `50x` |
| Parcours | `playwright test test/server-error.e2e.ts test/pages.e2e.ts test/csp.e2e.ts test/smoke.e2e.ts --workers 4` (7 tailles) | 357/357 |
| Intégrité | `pnpm integrity develop` | « Intégrité des tests : OK » (point de divergence 80b756b) |

`test/server-error.e2e.ts` (nouveau), à chaque taille d'écran : page servie par `page.route` à
`/une-page?vue=1` (503), `/api/v1/cv?lang=fr` (502), `/en/some-page` (504), `/en` (500) ; **sans
JavaScript** (clair et sombre) : contenu, titre, `lang`, lien d'évitement, en-tête sans bouton, liens,
`noindex` sans canonique ni `alternate`, aucun débordement, fond = `--bg` du schéma, seules requêtes
`stylesheet /_nuxt/*.css` et `font /fonts/*.woff2`, « Réessayer » redemande la même adresse, retour à
l'accueil ; **avec JavaScript** : idem + axe WCAG 2.2 AA, `data-theme` posé par le script de thème,
`window.__NUXT__` absent, `#__nuxt` jamais hydraté, aucune erreur ; réglages enregistrés appliqués
(thème inverse, contraste renforcé, texte 130 %) + axe ; **CSP stricte** recalculée sur toutes les pages
(fr, en) sans violation ni erreur, avec témoin sans empreintes ; plan du site sans `50x` ; page anglaise
sans libellé français. `csp.e2e.ts` (existant) inclut aussi les empreintes des nouvelles pages.

## Décisions

- **Mécanisme** : prérendu par `error.vue` puis retrait de l'application (ci-dessus), plutôt que
  `noScripts` ou un HTML écrit à la main.
- **Une page par langue, sans code affiché** : la même page sert quatre statuts ; afficher « 500 » pour un
  502 serait faux.
- **Gabarit annexe** : prop `controls` (vrai par défaut) plutôt qu'un second gabarit, pour garder un seul
  en-tête ; `error.vue` la passe à faux pour la seule page d'erreur serveur.
- **Titre français raccourci** (« Site indisponible pour l'instant ») : « momentanément » était coupé en
  plein mot à 390 px (capture).

## Non fait

- Branchement dans Caddy (pile et hôte) : lot 32 (dev-devops), documenté ci-dessus et dans
  `docs/deploiement.md`.

## Points ouverts

1. **Code de la 404 visible** : la 404 montre son code dans la barre (`>_ erreur-404.log`) mais pas en
   ligne de texte. En ajouter une (« Code de l'erreur : 404 ») contredirait `app/error.spec.ts` (test
   existant, « page introuvable », `expect(wrapper.find('.error-page__status').exists()).toBe(false)`) :
   non fait, à décider par Julien.
2. **`.env` racine fourni** : il contenait aussi le bloc de l'API (`PORT=3000`, `HOST=0.0.0.0`…). Or
   `playwright.config.ts` charge ce fichier et `sirv-cli` donne la priorité aux variables `PORT`/`HOST`
   sur `--port`/`--host` : le serveur des parcours écoutait sur `0.0.0.0:3000` et Playwright attendait
   `127.0.0.1:5821` (« Timed out waiting 30000ms from config.webServer », constaté par `ss -ltnp`). J'ai
   retiré `PORT` et `HOST` du `.env` racine de ce worktree (fichier local) ; à corriger dans le modèle
   de `.env` racine fourni aux agents.
3. **Charge machine** : deux premiers essais du pre-commit en échec par délais de démarrage de
   l'environnement Nuxt (`HookTimeoutError` 10 s, « Failed to start forks worker », charge 80 sur
   16 cœurs), sans lien avec le code (même suite verte seule). `TEST_MAX_WORKERS` ramené de 4 à 2 dans le
   `.env` racine du worktree.
4. **Textes à valider par Julien** : `serverError.*` de `common.json` (fr : « Site indisponible pour
   l'instant », « Le serveur n'a pas pu répondre à votre demande. Le problème est temporaire :
   réessayez dans quelques instants. », « Réessayer », « Retour à l'accueil » ; en : « Website temporarily
   unavailable », « The server could not answer your request. The problem is temporary: please try
   again in a few moments. », « Try again », « Back to the home page ») et le nom de fenêtre
   `erreur-50x.log`.
5. **Cas `/api/*`** : servir la page HTML ou garder une réponse brute aux clients JSON quand l'API est
   arrêtée : à trancher au lot 32.
6. **Lot 31 en parallèle** : mes changements partagés sont localisés (`nuxt.config.ts` : imports, liste
   `routes` et hook `prerender:generate` ; `common.json` : espace `serverError` ajouté en fin de
   fichier ; `layouts/annex.vue` : une prop). Conflit possible en fin de `common.json` si le lot 31 y
   ajoute aussi un espace : résolution triviale (deux blocs à garder).
