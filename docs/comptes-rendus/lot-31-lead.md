# Lot 31 : page « travaux en cours » du front (lead-architecte)

Date : 25 novembre 2026. Carte Trello 51. Branche `lot/31-page-travaux` (worktree
`personnalWebsite_V3-lot31`), depuis `develop` (80b756b). Isolation : projet compose `siteperso-v3-lot31`,
PostgreSQL 5872/5873, Playwright 5830, site e2e 5831. Règle D26 : vérifications ciblées. Aucun test existant
d'avant le lot modifié, aucune configuration protégée touchée.

## Commits

| Commit | Objet |
|---|---|
| 036f9f8 | `feat(web)` : AnnexPage sans lien de retour (`back` facultatif) |
| 7047103 | `feat(web)` : pages hors index (`useUnindexedPage`, `useIndexedPage`, app.vue) |
| c605432 | `feat(web)` : page « travaux en cours » (page, libellés fr/en, nuxt.config.ts) |
| d235995 | `test(web)` : parcours Playwright de la page |
| a97ed80 | `docs` : CLAUDE.md (convention « page hors index ») et ce compte rendu |
| 673bee4 | `feat(web)` : profil LinkedIn à la place du CV PDF (retour de Julien), tests de la page |
| 976b7d3 | `test(web)` : parcours de la page avec le profil LinkedIn |
| b093e24 | `docs` : compte rendu mis à jour |
| 28c7c4e | `feat(web)` : charge utile réduite à l'URL de LinkedIn (`fetchCvValue`, `linkedinUrl`, `useLinkedinUrl`), décision de Julien |
| edc15ce | `test(web)` : contrôle des charges utiles générées |
| (ce commit) | `docs` : compte rendu mis à jour |

## Fait

- `app/pages/travaux.vue` : `/travaux` (fr) et `/en/work-in-progress` (en, `i18n.pages`), gabarit `annex` par
  `routeRules` (en-tête : nom du site, accessibilité, langue, thème), fenêtre `>_ travaux-en-cours.md` :
  titre, deux paragraphes, puis deux boutons :
  - « Lancer l'entretien » (`ContactButton`, mailto vers `NUXT_PUBLIC_CONTACT_EMAIL`, adresse jamais
    affichée ; absente ou invalide, la page lève et la génération échoue, comme la déclaration
    d'accessibilité) ;
  - « Profil LinkedIn » / « LinkedIn profile » (retour de Julien, à la place du « CV PDF ») : l'URL est le
    lien social de slug `linkedin` du CV lu au build, à la même source que l'accueil (API ou fixtures selon
    `NUXT_CV_SOURCE`) ; aucune URL écrite en dur, aucun appel à l'API à l'affichage (la donnée vient de la
    charge utile). Décision de Julien : la charge utile ne contient que cette URL. Lecture par
    `useLinkedinUrl` (`composables/use-cv.ts`) → `fetchCvValue` (`data/fetch-cv.ts`, clé
    `cv-<langue>-linkedin`, distincte de `cv-<langue>` de l'accueil, qui ne change pas) → `linkedinUrl`
    (`data/map-cv.ts`) dans le gestionnaire de `useAsyncData`, exécuté au build seulement. La page n'importe
    rien de `data/`. Lien absent des données : « Lien LinkedIn absent du CV : la page « travaux en cours »
    attend un lien social de slug « linkedin » (social_links). », la génération échoue. Charges utiles
    générées : 145 octets chacune (`{"cv-fr-linkedin": "<url>"}`), au lieu de 21 Ko avec le CV entier. Lien externe par la convention du site (`LinkButton` avec `external-label`
    `common.opensInNewTab`) : `target="_blank"`, `rel="noopener noreferrer"`, nom accessible « Profil
    LinkedIn (s'ouvre dans un nouvel onglet) » / « LinkedIn profile (opens in a new tab) ». Style du bouton
    CV d'avant (`outline`, `md`, icône décorative, celle de LinkedIn de `SocialLinks`).
  - Retirés de la page : `CvButton`, `CV_DIRECTORY`, `cvFileName` (toujours employés par l'accueil).
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
- `travaux/_payload.json` et `en/work-in-progress/_payload.json` : charges utiles (145 octets, la seule URL
  de LinkedIn). Depuis le lien LinkedIn, la page les lit à l'hydratation (`useAsyncData`), et non plus
  seulement lors d'un changement de langue : le proxy doit les servir (comportement sans elles non vérifié) ;
- pas de page `/fr/travaux` (la règle `/fr/**` reste une redirection du proxy).

Ressources demandées par la page (sonde Playwright, chargement puis changement de langue) : `/_nuxt/*`
(scripts, feuilles, `builds/meta/<id>.json`), `/_i18n/<hash>/{fr,en}/messages.json`, `/fonts/*`, les deux
`_payload.json` ci-dessus, et `/_payload.json` (préchargement du lien « accueil » de l'en-tête, sans
conséquence si le proxy le refuse). Pendant les travaux, le proxy doit laisser passer ces chemins sans les
rediriger. `/cv/*` n'est plus demandé par la page.

Statut et adresse (vérifiés) : la page ne suppose rien du statut. Servie en 503 (avec `Retry-After`) à
son propre chemin, elle s'affiche et s'hydrate normalement, axe compris (parcours permanent). Servie par
réécriture à une autre adresse (sonde non versionnée : HTML de `travaux/index.html` servi à `/`, de
`en/work-in-progress/index.html` à `/en/accessibility`, en 503), Nuxt hydrate la route rendue (chemin de
la charge utile, `createCurrentLocation` du routeur de Nuxt 4.6.4) et remplace l'adresse affichée par
`/travaux` ou `/en/work-in-progress` ; seule erreur de console : la ligne du navigateur « Failed to
load resource: 503 » du document. Le proxy choisit donc la langue : `/en` et `/en/*` vers la page anglaise,
le reste vers la page française. (Sonde faite avant le passage à LinkedIn ; le mécanisme de routage n'a pas
changé.)

## Vérifications

Après la décision de Julien sur la charge utile (site régénéré sur les fixtures) :

| Vérification | Résultat |
|---|---|
| `pnpm --filter @siteperso/web test:coverage` | 131 fichiers, 1158 tests verts ; 100 % sur les quatre métriques (1457 instructions, 777 branches, 475 fonctions, 1296 lignes) |
| `pnpm --filter @siteperso/web lint` puis `typecheck` | verts (zéro avertissement) |
| `stryker run --mutate app/data/fetch-cv.ts,app/data/map-cv.ts` | 100 % : 121 mutants tués, aucun survivant (`fetch-cv.ts` 27, `map-cv.ts` 94), seuil 100 |
| `playwright test test/work-in-progress.e2e.ts` (7 tailles) | 98 verts |
| `playwright test test/pages.e2e.ts test/csp.e2e.ts` (7 tailles) | 161 verts (plan du site exact, CSP de toutes les pages) |
| `pnpm integrity 80b756b` | OK |
| `pnpm db:down` | conteneurs du lot arrêtés après la série |

Nouveaux tests : `app/pages/travaux.spec.ts` (fr/en, contact, LinkedIn du CV, nouvel onglet et
`noopener noreferrer`, méta, erreur sans adresse), `app/pages/travaux-linkedin.spec.ts` (source du CV sans
lien `linkedin` : erreur explicite par le vrai chemin de lecture), `app/data/fetch-cv-value.spec.ts`
(charge utile réduite à la valeur choisie sous `cv-<langue>-<nom>`, erreur de sélection relevée, valeur vide
refusée), `app/data/map-cv-linkedin.spec.ts` (slug `linkedin` et non `linkedin-recommendations`, erreur
quand il manque), `app/app-unindexed.spec.ts` (racine sans canonique ni hreflang ni `og:url`,
retour à l'indexation après navigation), `app/composables/seo/useSeo-unindexed.spec.ts`,
`app/components/annex/AnnexPage-without-back.spec.ts`, `test/work-in-progress.e2e.ts` (clair et sombre, fr
et en, axe, thème, langue, LinkedIn, débordement, 503, plan du site, CSP ; charges utiles générées des
deux pages : une seule donnée, `cv-<langue>-linkedin` = l'URL, ni `profile`, `experiences`,
`recommendations`, `skillGroups`, `socialLinks`, `cv-fr` ou `cv-en` dans `_payload.json` ni dans
`__NUXT_DATA__` ; témoin : la charge utile de l'accueil contient bien ces champs, donc le contrôle mord).

## Décisions

- **Hors index déclaré par la page** (`useUnindexedPage`), et non par une liste de routes ou une clé de
  `routeRules` : une clé personnalisée de `routeRules` n'arrive pas au navigateur (Nuxt ne garde que
  `VALID_MANIFEST_KEYS` dans son manifeste), et une liste de routes est ce que `domain/sitemap.ts` évite.
  L'état garde le chemin, non un booléen : il ne vaut que pour cette page, sans remise à zéro au démontage.
- **Pas de lien « Retour à l'accueil »** : pendant les travaux, l'accueil mène à cette page (`back`
  facultatif dans AnnexPage, changement minimal). Le nom du site de l'en-tête reste un lien vers l'accueil,
  comme sur les autres pages annexes.
- **Bouton de contact de l'accueil réutilisé** (« Lancer l'entretien ») : même mécanisme, même sujet de mail.
- **Charge utile réduite à l'URL de LinkedIn** (décision de Julien, première piste du compte rendu
  précédent) : la sélection se fait dans le gestionnaire de `useAsyncData` (`fetchCvValue(deps, langue,
  nom, sélection)`), et non par l'option `pick` de Nuxt. `pick` ne garde que des clés de premier niveau
  (`socialLinks` entier, avec les recommandations LinkedIn) et laisserait la sélection et l'échec hors de
  `data/`, sans test unitaire ni mutation. `fetchCv` et `fetchCvValue` partagent la même lecture
  (`read`) ; `fetchCv`, sa clé `cv-<langue>` et l'accueil ne changent pas (`fetch-cv.spec.ts` inchangé et
  vert). Les types `FetchCvDeps` et `AsyncDataResult` prennent un paramètre de type (par défaut `Cv`, donc
  compatibles avec les tests existants). La page n'importe que le composable `useLinkedinUrl` ; seul
  `composables/use-cv.ts` relie `data/` à `useAsyncData`, comme avant.
- Libellé propre à la page (`workInProgress.linkedin`) plutôt que le libellé « LinkedIn » servi par l'API :
  nom explicite demandé par Julien.
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
| `workInProgress.next` (texte de Julien) | En attendant, vous pouvez m’écrire ou me retrouver sur LinkedIn. | In the meantime, you can email me or find me on LinkedIn. |
| `workInProgress.description` (méta) | Le site de Julien Lachaux est en cours de construction. En attendant, vous pouvez lui écrire ou le retrouver sur LinkedIn. | Julien Lachaux’s website is under construction. In the meantime, you can email him or find him on LinkedIn. |
| `workInProgress.linkedin` (bouton) | Profil LinkedIn | LinkedIn profile |

Nom de fichier de la fenêtre : `travaux-en-cours.md` (non traduit, comme `declaration-accessibilite.md`).

## Points ouverts

- Réglé (décision de Julien) : le CV complet n'est plus dans la charge utile de la page des travaux (21 Ko
  auparavant, 145 octets désormais, contrôlé par le parcours). Reste publique, comme sur tout le site, la
  charge utile de l'accueil (`/_payload.json`, CV entier) : pendant les travaux, c'est au proxy (lot 32) de
  ne pas la servir à qui n'a pas la clé ; la page des travaux la précharge seulement (lien d'accueil de
  l'en-tête) et n'en a pas besoin.
- Les fonctions de politique CSP sont recopiées dans `test/work-in-progress.e2e.ts` depuis `test/csp.e2e.ts`
  (qui n'exporte rien, et `test/support/` est protégé). À factoriser dans `test/support/` sous autorisation,
  ou en ajoutant les deux adresses à la liste de `csp.e2e.ts` (test existant, correcteur).
- La recherche de libellés français dans les pages `/en` (`pages.e2e.ts`, liste `ENGLISH_PAGES`) ne couvre
  pas `/en/work-in-progress` : relu à la main sur le HTML généré, rien de français hors « FR | EN » et
  « RGAA ». L'ajouter modifie un test existant (correcteur).
- Conflits possibles avec le lot 30 : `nuxt.config.ts` (`i18n.pages`, `routeRules`, `prerender.routes`),
  `common.json` (nouvelle clé après `annex`), `AnnexPage.vue` (`back` facultatif) ; changements courts et
  localisés.
- Refus d'un garde-fou (retour de Julien) : un script `python3` qui remplaçait les assertions du CV par
  celles de LinkedIn dans `test/work-in-progress.e2e.ts` (test créé dans ce lot) a été refusé : « écriture
  opaque (python3) qui mentionne un oracle (app/data/fixtures) », le chemin figurant seulement dans un
  commentaire ajouté. Aucune fixture n'était visée. Les mêmes changements ont été faits par l'outil
  d'édition, écriture lisible sur ce seul fichier, et le commentaire ne cite plus le dossier des fixtures.
- Podman saturé pendant le lot : un premier `pnpm e2e:browsers:up` a dépassé 5 minutes (tué) et `podman ps`
  a mis plusieurs minutes à répondre. Le second essai, une fois la charge retombée, a abouti.
