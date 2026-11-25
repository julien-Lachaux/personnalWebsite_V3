# Lot 31 : page « travaux en cours » du front (lead-architecte)

Date : 25 novembre 2026. Carte Trello 51. Branche `lot/31-page-travaux` (worktree
`personnalWebsite_V3-lot31`), depuis `develop` (80b756b). Isolation : projet compose `siteperso-v3-lot31`,
PostgreSQL 5872/5873, Playwright 5830, site e2e 5831. Règle D26 : vérifications ciblées. Aucun test existant
modifié, aucune configuration protégée touchée.

## Commits

| Commit | Objet |
|---|---|
| 036f9f8 | `feat(web)` : AnnexPage sans lien de retour (`back` facultatif) |
| 7047103 | `feat(web)` : pages hors index (`useUnindexedPage`, `useIndexedPage`, app.vue) |
| c605432 | `feat(web)` : page « travaux en cours » (page, libellés fr/en, nuxt.config.ts) |
| d235995 | `test(web)` : parcours Playwright de la page |
| (ce commit) | `docs` : CLAUDE.md (convention « page hors index ») et ce compte rendu |

## Fait

- `app/pages/travaux.vue` : `/travaux` (fr) et `/en/work-in-progress` (en, `i18n.pages`), gabarit `annex` par
  `routeRules` (en-tête : nom du site, accessibilité, langue, thème), fenêtre `>_ travaux-en-cours.md` :
  titre, deux paragraphes, bouton « Lancer l'entretien » (`ContactButton`, mailto vers
  `NUXT_PUBLIC_CONTACT_EMAIL`, adresse jamais affichée ; absente ou invalide, la page lève et la génération
  échoue, comme la déclaration d'accessibilité) et bouton « CV PDF » (`CvButton`, `/cv/cv-<langue>.pdf` ;
  le CV anglais absent, repli sur `/cv/cv-fr.pdf` avec « (in French) » et `hreflang="fr"`, `useCvLink`, D22).
  Aucun appel à l'API, ni au build ni à l'affichage (pas de `useCv`).
- Hors index : `useUnindexedPage()` (composables/seo/useSeo.ts) pose `robots: noindex` et note le chemin de
  la page dans un `useState` ; app.vue lit `useIndexedPage()` et ne pose alors ni canonique, ni hreflang, ni
  `og:url`, ni `og:locale`. La page n'entre donc pas dans `sitemap.xml` (domain/sitemap.ts, sans canonique ;
  `pages.e2e.ts` vérifie la liste exacte, toujours vert).
- Prérendu : `/travaux` et `/en/work-in-progress` ajoutés à `nitro.prerender.routes`, aucun lien n'y mène.
- CSP stricte : aucun élément en ligne ajouté ; la page passe sous la politique du déploiement.
- CLAUDE.md : `pages/` et `composables/seo/` complétés, règle « page hors index » dans « Référencement ».

## Chemins produits pour le lot 32 (Caddy)

Fichiers générés dans `apps/web/.output/public/` :

- `travaux/index.html` (fr) et `en/work-in-progress/index.html` (en) : les pages ;
- `travaux/_payload.json` et `en/work-in-progress/_payload.json` : charges utiles, lues lors d'une
  navigation dans l'application (sélecteur de langue) ;
- pas de page `/fr/travaux` (la règle `/fr/**` reste une redirection du proxy).

Ressources demandées par la page (sonde Playwright, chargement puis changement de langue) : `/_nuxt/*`
(scripts, feuilles, `builds/meta/<id>.json`), `/_i18n/<hash>/{fr,en}/messages.json`, `/fonts/*`, `/cv/cv-fr.pdf`
(au clic), les deux `_payload.json` ci-dessus, et `/_payload.json` (préchargement du lien « accueil » de
l'en-tête, sans conséquence si le proxy le refuse). Pendant les travaux, le proxy doit laisser passer
ces chemins sans les rediriger.

Statut et adresse (vérifiés) : la page ne suppose rien du statut. Servie en 503 (avec `Retry-After`) à
son propre chemin, elle s'affiche et s'hydrate normalement, axe compris (parcours permanent). Servie par
réécriture à une autre adresse (sonde non versionnée : HTML de `travaux/index.html` servi à `/`, de
`en/work-in-progress/index.html` à `/en/accessibility`, en 503), Nuxt hydrate la route rendue (chemin de
la charge utile, `createCurrentLocation` du routeur de Nuxt 4.6.4) et remplace l'adresse affichée par
`/travaux` ou `/en/work-in-progress` ; seule erreur de console : la ligne du navigateur « Failed to
load resource: 503 » du document. Le proxy choisit donc la langue : `/en` et `/en/*` vers la page anglaise,
le reste vers la page française.

## Vérifications

| Vérification | Résultat |
|---|---|
| `pnpm --filter @siteperso/web test:coverage` | 128 fichiers, 1152 tests verts ; 100 % sur les quatre métriques (1444 instructions, 773 branches, 465 fonctions, 1284 lignes) |
| `pnpm --filter @siteperso/web lint` puis `typecheck` | verts (zéro avertissement) |
| `playwright test test/work-in-progress.e2e.ts` (7 tailles) | 77 verts |
| `playwright test test/pages.e2e.ts test/csp.e2e.ts` (7 tailles) | 161 verts (plan du site exact, CSP de toutes les pages, empreintes de la nouvelle page comprises) |
| `pnpm integrity 80b756b` | OK |
| Mutation | sans objet : aucun fichier de `app/domain` ni `app/data` modifié |
| `pnpm db:down` | conteneurs du lot arrêtés après la série |

Nouveaux tests : `app/pages/travaux.spec.ts` (fr/en, liens, repli du CV, CV anglais présent, méta, erreur sans
adresse), `app/app-unindexed.spec.ts` (racine sans canonique ni hreflang ni `og:url`, retour à l'indexation
après navigation), `app/composables/seo/useSeo-unindexed.spec.ts`, `app/components/annex/AnnexPage-without-back.spec.ts`,
`test/work-in-progress.e2e.ts` (clair et sombre, fr et en, axe, thème, langue, débordement, 503, plan du site, CSP).

## Décisions

- **Hors index déclaré par la page** (`useUnindexedPage`), et non par une liste de routes ou une clé de
  `routeRules` : une clé personnalisée de `routeRules` n'arrive pas au navigateur (Nuxt ne garde que
  `VALID_MANIFEST_KEYS` dans son manifeste), et une liste de routes est ce que `domain/sitemap.ts` évite.
  L'état garde le chemin, non un booléen : il ne vaut que pour cette page, sans remise à zéro au démontage.
- **Pas de lien « Retour à l'accueil »** : pendant les travaux, l'accueil mène à cette page (`back`
  facultatif dans AnnexPage, changement minimal). Le nom du site de l'en-tête reste un lien vers l'accueil,
  comme sur les autres pages annexes.
- **Boutons de l'accueil réutilisés** (« Lancer l'entretien », « CV PDF ») plutôt que de nouveaux libellés :
  même mécanisme, même sujet de mail, rien de neuf à traduire.
- Libellés dans `common.json` (`workInProgress.*`, inséré après `annex`, loin de `notFound` et `error`
  que le lot 30 modifie) : un nouveau fichier de libellés ferait échouer `i18n-messages.spec.ts`, qui fixe
  la liste des fichiers.
- `.env` racine du worktree : le fichier fourni portait aussi les variables de l'API (`PORT=3000`,
  `HOST=0.0.0.0`…). `playwright.config.ts` le charge et sirv-cli fait passer `PORT` et `HOST` avant
  `--port` et `--host` : le serveur statique écoutait sur `0.0.0.0:3000`, et Playwright attendait 5831
  jusqu'au délai (« Timed out waiting 30000ms from config.webServer », processus vu à l'écoute sur 3000).
  J'ai gardé dans ce `.env` (gitignoré) les seules clés d'isolation ; les variables de l'API restent dans
  `apps/api/.env`.

## Textes proposés (à valider par Julien)

| Clé | Français | Anglais |
|---|---|---|
| `workInProgress.title` | Site en cours de construction | Site under construction |
| `workInProgress.intro` | Je reconstruis ce site de fond en comble. Il revient bientôt, avec mon parcours, mes expériences et les technologies que j’utilise. | I’m rebuilding this site from the ground up. It will be back soon, with my background, experience and the technologies I work with. |
| `workInProgress.next` | En attendant, vous pouvez m’écrire ou télécharger mon CV. | In the meantime, you can email me or download my CV. |
| `workInProgress.description` (méta) | Le site de Julien Lachaux est en cours de construction. En attendant, vous pouvez lui écrire ou télécharger son CV. | Julien Lachaux’s website is under construction. In the meantime, you can email him or download his CV. |

Nom de fichier de la fenêtre : `travaux-en-cours.md` (non traduit, comme `declaration-accessibilite.md`).

## Points ouverts

- Les fonctions de politique CSP sont recopiées dans `test/work-in-progress.e2e.ts` depuis `test/csp.e2e.ts`
  (qui n'exporte rien, et `test/support/` est protégé). À factoriser dans `test/support/` sous autorisation,
  ou en ajoutant les deux adresses à la liste de `csp.e2e.ts` (test existant, correcteur).
- La recherche de libellés français dans les pages `/en` (`pages.e2e.ts`, liste `ENGLISH_PAGES`) ne couvre
  pas `/en/work-in-progress` : relu à la main sur le HTML généré, rien de français hors « FR | EN » et
  « RGAA ». L'ajouter modifie un test existant (correcteur).
- Conflits possibles avec le lot 30 : `nuxt.config.ts` (`i18n.pages`, `routeRules`, `prerender.routes`),
  `common.json` (nouvelle clé après `annex`), `AnnexPage.vue` (`back` facultatif) ; changements courts et
  localisés.
- Podman saturé pendant le lot : un premier `pnpm e2e:browsers:up` a dépassé 5 minutes (tué) et `podman ps`
  a mis plusieurs minutes à répondre. Le second essai, une fois la charge retombée, a abouti.
