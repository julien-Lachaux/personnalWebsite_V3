# Revue de sécurité du front V3 (lot F10) — 23 novembre 2026

## En-tête

- **Périmètre** : `apps/web/` sur `lot/F10-revues` (`origin/develop` ba79093, tête add5a22), site publié
  par `pnpm --filter @siteperso/web generate:fixtures` (`.output/public`), PDF `public/cv/cv-fr.pdf`,
  service du front dans la pile en **lecture seule** (`docker/Caddyfile`, `docker/web.Dockerfile`,
  `docker/compose.prod.yml`, `scripts/deploy/csp-hashes.mjs`, `scripts/deploy/web-generate.sh`).
  Références : `CLAUDE.md` (Front), `docs/05` (D1–D30, D20, D22), SPEC § 11.
- **Méthode** : constat par commande (lecture de code et de configuration, sortie générée, `pnpm audit`,
  conteneur Alpine jetable pour le PDF), sans charge utile ni exploitation. Revue indépendante : les
  revues code et accessibilité n'ont pas été lues.
- **Commandes principales** : `pnpm --filter @siteperso/contracts build` puis `pnpm run generate:fixtures`
  (code 0, 15 routes) ; une seconde génération avec une valeur témoin dans `NUXT_API_BASE_URL` ;
  `grep` sur `.output/public` ; `pnpm audit --prod` et `pnpm audit` ; `pnpm ignored-builds` ;
  `docker run --rm alpine:3.24.4@sha256:f59a…` (exiftool, pdfinfo, pdftotext, pdfimages, qpdf --check,
  PDF monté en lecture seule) ; `git log -p --all`, `git rev-list --all --objects` ; `docker inspect`.
- **Nettoyage** : copie du site et texte extrait du PDF supprimés du dossier temporaire ; aucun conteneur
  laissé (`--rm`). `apps/web/.output/` et `packages/contracts/dist/` (ignorés par git) sont laissés en
  place : le worktree est partagé avec les deux autres revues (le service `playwright` du projet
  `siteperso-v3-f10` tournait). `git status` ne montre que ce rapport.

## Tableau

| Id   | Gravité | Sujet                                                                           | Fichiers                                                                       |
| ---- | ------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| RS-1 | Faible  | `cvPath` admet un chemin que le navigateur résout hors du site                  | `packages/contracts/src/profile/profile.ts:10`, `apps/web/app/domain/cv-link.ts` |
| RS-2 | Faible (décision) | Adresse de contact publiée en clair sur chaque page, contraire à SPEC § 11 | `app/composables/shell/useContactLink.ts`, `nuxt.config.ts` (`runtimeConfig.public`) |
| RS-3 | Info    | Fixtures, Zod et source API publiées et préchargées par chaque page              | `app/data/select-cv-source.ts:7`, `app/data/fixture-cv-source.ts:6-7`            |
| RS-4 | Info    | Avis modéré `minimatch` dans la chaîne de build (pas dans le site publié)        | `pnpm-lock.yaml` (nuxt > nitropack > archiver > readdir-glob)                   |
| RS-5 | Info    | `img-src 'self' data:` alors qu'aucune image `data:` n'est utilisée              | `scripts/deploy/csp-hashes.mjs:82` (périmètre back)                             |
| RS-6 | Info    | Serveur Playwright sans authentification, paquet téléchargé à chaque démarrage   | `docker-compose.yml:70-77`                                                       |

## RS-1 — `cvPath` admet un chemin résolu hors du site (faible)

- **Fichiers** : `packages/contracts/src/profile/profile.ts:10` (`SITE_PATH_PATTERN = /^\/[^/\s]\S*$/`),
  `apps/web/app/domain/cv-link.ts:33-40` (adresse rendue telle quelle), `components/shell/CvButton.vue`.
- **Condition** : le champ `cv_path` d'une traduction du profil contient un chemin dont le deuxième
  caractère est une barre oblique inverse. La base ne l'empêche pas (`profile_translations_cv_path_check` :
  non vide seulement).
- **Constat** : `node -e` sur le motif et sur `new URL(<chemin>, "https://site.example").host` :
  `"/cv/cv-fr.pdf" regex: true hôte: site.example` ; `"//hote.example/x.pdf" regex: false` ;
  chemin à barre inverse : `regex: true hôte: hote.example`. Le contrat refuse le `//` mais pas sa
  variante que les navigateurs normalisent de la même façon.
- **Impact** : le bouton « CV PDF » (attribut `download`, sans `rel`, `LinkButton` ne le traite pas comme
  externe) mènerait à un autre hôte.
- **Atténuants** : contenu écrit par Julien dans les seeds, API en lecture seule sans CRUD, validation au
  build seulement ; aucune entrée d'un tiers.
- **Proposition** : brief vers la session back (contrats) : exclure `\` du motif (premier caractère et
  suite) et, côté base, une contrainte `cv_path like '/cv/%'` ; ou, côté front, n'accepter qu'un chemin
  sous `CV_DIRECTORY`.

## RS-2 — Adresse de contact publiée en clair sur chaque page (faible, décision)

- **Fichiers** : `app/composables/shell/useContactLink.ts:11-14`, `app/pages/accessibilite.vue:33`,
  `nuxt.config.ts` (`runtimeConfig.public.contactEmail`).
- **Condition** : `NUXT_PUBLIC_CONTACT_EMAIL` est posée au build de production (obligatoire).
- **Constat** : avec le placeholder, `grep -rhoE '<motif e-mail>' .output/public` donne 13 occurrences ;
  l'adresse est dans chacune des 7 pages HTML (`href="mailto:…"` et `window.__NUXT__.config.public`).
  Le PDF publié sous `/cv/cv-fr.pdf` contient aussi une adresse et un numéro (D22). SPEC § 11 : « Ne pas
  publier e-mail ni téléphone en clair ».
- **Impact** : adresse moissonnable par les robots (pourriel) ; même chose pour le numéro via le PDF.
- **Atténuants** : contact par `mailto:` décidé (pas de formulaire) ; D22 accepte e-mail et téléphone dans
  le PDF ; l'adresse est validée par une liste de caractères (aucun paramètre `mailto:` injectable).
- **Proposition** : décision de Julien : accepter l'écart avec SPEC § 11 en le consignant dans docs/05, et
  utiliser une adresse dédiée (alias) plutôt que l'adresse personnelle.

## RS-3 — Fixtures publiées et préchargées (info)

- **Fichiers** : `app/data/select-cv-source.ts:5-7` importe statiquement `ApiCvSource` et
  `FixtureCvSource`, qui importe `fixtures/cv.fr.ts` et `cv.en.ts` ; `fetch-cv.ts` les charge par
  `import()` dynamique.
- **Constat** : `.output/public/_nuxt/k2bm6MiX.js` (138 603 octets) contient Zod, le chemin
  `api/v1/cv`, les messages d'erreur de la source et les fixtures (texte des recommandations) ; chaque
  page le cite en `<link rel="prefetch" as="script">`. Le choix de la source se fait à l'exécution :
  un build de production produit le même découpage.
- **Impact** : le jeu de fixtures (placeholders et copies de recommandations, éventuellement différentes du
  contenu servi par l'API) est publié et téléchargé par les navigateurs ; aucun secret.
- **Atténuants** : le chunk n'est pas exécuté (F9a, pas de violation CSP) ; valeurs privées absentes
  (voir « Fait »).
- **Proposition** : lead-architecte : n'importer les fixtures que côté serveur (module `.server` ou garde
  `import.meta.server` dans `fetch-cv.ts`) pour qu'elles sortent du bundle client.

## RS-4 — Avis `minimatch` dans la chaîne de build (info)

- **Constat** : `pnpm audit --prod` (dans `apps/web`) : 1 modérée, GHSA-g3hv-75wg-m249, chemin
  `nuxt > @nuxt/nitro-server > nitropack > archiver > readdir-glob > minimatch` (versions installées
  10.2.6 et 11.0.9). `pnpm view nuxt version` : 4.6.4 (déjà la dernière) ; `readdir-glob` 4.0.0 dépend de
  `minimatch ^11.0.1`. `pnpm audit` complet : côté web, seule s'ajoute `glob` via
  `@vue/test-utils > js-beautify` (test).
- **Impact** : déni de service sur des motifs fournis par un attaquant ; ici les motifs viennent de la
  configuration du build, jamais du site statique publié.
- **Proposition** : suivre la mise à jour de nitropack ; un `overrides` n'est utile que si l'avis passe en
  élevé.

## RS-5 — `img-src` plus large que nécessaire (info)

- **Constat** : `grep -rhoE 'data:image/[a-z+]+'` sur les HTML, CSS et JS générés : aucune occurrence ;
  `buildPolicy` pose `img-src 'self' data:`.
- **Proposition** : brief back : `img-src 'self'` (le test `csp.e2e.ts` signalerait un besoin réel).

## RS-6 — Serveur de navigateurs Playwright (info)

- **Constat** : `docker inspect siteperso-v3-f10-playwright-1` : port `127.0.0.1:5964 -> 3000`, utilisateur
  `pwuser` ; commande `npx -y playwright@1.65.1 run-server --host 0.0.0.0` (version exacte, mais paquet
  téléchargé au démarrage, hors intégrité du lockfile) ; le WebSocket n'a pas d'authentification.
- **Impact** : un processus local (ou un conteneur du réseau du projet) peut piloter les navigateurs ;
  outillage de développement seulement.
- **Proposition** : acceptable en l'état ; consigner le choix, ou épingler par une image qui embarque déjà
  le paquet.

## Fait (constats sans défaut)

- **XSS** : `vue/no-v-html` et `vue/no-v-text-v-html-on-component` en erreur (`eslint.config.js:44-45`) ;
  aucun `v-html`, `innerHTML`, `eval` dans `app/` hors spécs ; pages générées : 0 attribut `style=`,
  0 gestionnaire `on*=`, 0 `javascript:`. Charge utile `__NUXT_DATA__` : aucun `<` brut (échappement
  `/`). Messages i18n sans HTML.
- **Liens** : tous les `target="_blank"` des 6 pages portent `rel="noopener noreferrer"` ; URL de l'API
  limitées à `http(s)` par `HttpUrlSchema` (contrats) ; `mailto:` construit depuis la configuration, adresse
  filtrée par liste de caractères, sujet encodé.
- **Configuration privée** : génération avec une valeur témoin dans `NUXT_API_BASE_URL` : 0 occurrence dans
  `.output` ; `window.__NUXT__.config` ne contient que `public` et `app`.
- **Pages d'erreur** : `404.html` et `en/404.html` sans pile ni chemin interne (statut et libellé seulement).
- **Stockage local** : une clé de préférences, valeurs filtrées par liste (thème, taille) ou booléen, dans le
  script de thème comme dans `parsePreferences` ; erreurs absorbées.
- **CSP (lecture)** : 3 scripts exécutables en ligne par page (carte d'import, thème, `window.__NUXT__`) et
  49 `<style>` sur l'accueil, tous couverts par la politique de `csp-hashes.mjs` (aucun `unsafe-*`,
  `connect-src`, `font-src` limités à `'self'`) ; `THEME_SCRIPT_SHA256` vérifiée par
  `theme-script.spec.ts:269` et la CSP par `test/csp.e2e.ts` (violations relevées).
- **Données personnelles** : site généré : seule adresse `contact@example.org`, aucun numéro (les suites de
  chiffres trouvées sont des constantes JavaScript) ; dépôt `apps/web` : seules des adresses de test
  (`example.org`, domaines factices) ; historique complet : aucune adresse de messagerie personnelle ni
  numéro dans les lignes de diff (seul `tel:+33100000000`, placeholder) ; seul `.env.example` versionné ;
  `.env` exclus du contexte de build (`web.Dockerfile.dockerignore`). Le nom de Julien dans la description
  SEO relève de D20.
- **PDF** : exiftool : aucune métadonnée hors système ; pdfinfo : pas de flux XMP, pas de JavaScript, pas de
  formulaire, pas d'image ; aucune clé `/Info`, `/Metadata`, `/JavaScript`, `/OpenAction`, `/EmbeddedFile`
  dans le fichier ; `qpdf --check` sans erreur. Texte : une adresse, un numéro (D22), une ville, un lien de
  profil LinkedIn ; aucune adresse postale, date de naissance ni autre donnée. Un seul blob du PDF dans
  l'historique (3593c99) : aucune version non nettoyée.
- **Dépendances** : versions exactes dans `apps/web/package.json` ; `onlyBuiltDependencies` :
  `@swc/core`, `esbuild` ; `pnpm ignored-builds` : aucun ; pnpm 10.34.9.
- **Outils de test** : serveurs locaux de `generate-without-ai.mjs` et `ai-placeholder.e2e.ts` sur
  `127.0.0.1`, port éphémère, fermés en `finally` ; `sirv` sur `127.0.0.1`.
- **Caddy (lecture)** : HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`,
  `X-Frame-Options: DENY`, CSP importée par version publiée, `/fr` en 301 avec liste blanche, 404 du front
  avec son statut, pas de listage de répertoire.

## Non fait

- **Relevé de la CSP par `csp-hashes.mjs`** : `node scripts/deploy/csp-hashes.mjs <copie du site>
  <fichier temporaire>` refusé par les garde-fous (« écriture opaque (node) qui mentionne un oracle
  (apps/api/test/csp-hashes.e2e-spec.ts) ») ; je cherchais à produire la politique de cette génération
  pour la comparer aux éléments en ligne. Non reformulé.
- **Recalcul indépendant de l'empreinte du script de thème** : extraction par `perl` en ligne refusée
  (« code en ligne calculé (perl) : illisible, donc refusé »). Non reformulé ; couverture par
  `theme-script.spec.ts` et `csp.e2e.ts` (non relancés ici).
- **En-têtes de la pile locale** : `pnpm stack:up` non lancé (dépend du relevé CSP refusé, build des images
  lourd sur une machine partagée). **À vérifier** sur la pile locale puis après déploiement :
  `curl -skI https://localhost:<port>/`, `/en`, `/fr/accessibilite`, `/inconnue` : CSP sans `unsafe-*`
  contenant `'sha256-nzuLVqI8…'`, HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, absence de
  `Server` ; `/fr/accessibilite` en 301 vers `/accessibilite` ; `/inconnue` en 404 avec la page du front
  et la CSP.
- Captures PNG de `apps/web/design/` non inspectées visuellement (non publiées).

## Décisions

- Le nom de Julien (description SEO, en-tête mobile) et les noms des auteurs de recommandations
  (fixtures, seeds) sont traités comme contenu public voulu (D20), pas comme findings.
- Ville du profil (PDF, contrats) : donnée publique du CV, hors interdit de D20.

## Points ouverts

- RS-2 : décision de Julien (écart SPEC § 11, alias dédié).
- RS-1 et RS-5 : briefs vers la session back (contrats, `csp-hashes.mjs`).
- RS-3 : décision du lead-architecte (fixtures hors bundle client).
- Image `alpine:3.24.4@sha256:f59a…` (celle de `clean-cv-pdf.sh`) laissée sur l'hôte : présence antérieure
  non déterminée.
