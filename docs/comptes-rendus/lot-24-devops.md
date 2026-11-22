# Lot 24 : servir le front statique dans la pile (dev-devops)

Brief `docs/briefs/back-005-service-du-front.md`, tickets BF-13, BF-14, BF-15. Branche `lot/24-service-front`
(depuis `lot/22-un-seul-run`). Rien n'a été poussé.

## Réserve principale : le démon Docker était absent

Au moment du lot, Docker Desktop n'est pas branché sur la distribution WSL (`/usr/bin/docker` est un lien vers
`/mnt/wsl/docker-desktop/cli-tools/usr/bin/docker`, dossier vide) :

```
$ docker version
(eval):1: command not found: docker
$ find /mnt/wsl/docker-desktop/cli-tools -maxdepth 4
/mnt/wsl/docker-desktop/cli-tools
$ ls -l /var/run/docker.sock
ls: cannot access '/var/run/docker.sock': No such file or directory
```

**Je n'ai donc pas pu lancer `pnpm stack:up`, ni construire l'image, ni essayer Caddy, ni lancer le parcours
navigateur.** C'est le point que la recette doit regarder : la CI (job `pile-locale`) est le premier vrai
essai de la pile. J'ai en plus tenté de télécharger un binaire Caddy dans le dossier temporaire de la session pour valider
au moins le `Caddyfile` (`caddy validate`) : la commande a été refusée par le classificateur de permissions
(« Undermining Oversight »), je n'ai pas contourné. Le `Caddyfile` n'est donc relu qu'à la main.

Ce qui a pu être essayé sans Docker :

- `pnpm --filter @siteperso/web generate:fixtures` sur l'hôte : le front se génère (8 pages HTML, `404.html` et
  `200.html` identiques, `fr/` avec les pages `meta refresh`).
- `scripts/deploy/csp-hashes.mjs` sur cette vraie sortie : 8 pages, 3 scripts et 45 styles distincts ; l'empreinte
  du script de thème (`sha256-nzuLVqI8ekzAXFcdRbwjQkxQig8MPDlNQ5+0PkfBJwY=`) y figure ; chaque script en ligne
  exécutable des cinq pages types est couvert (0 manquant) ; en-tête de 2,8 Kio.
- Les trois fichiers de test qui ne demandent pas Docker, avec une configuration Vitest jetable hors dépôt (le
  projet `e2e` exige la base de test via Docker) :
  `csp-hashes` (6 tests), `web-generate` (6 tests, faux `nuxt`), `web-front-config` hors compose (11 tests), et
  `local-stack-front` en mode « pile absente » : 24 réussis, 6 sautés (les tests `docker compose config`, qui
  échouent faute de Docker, comme ceux de `prod-compose.e2e-spec.ts`).
- `bash -n` / `sh -n` sur tous les scripts ; `pnpm integrity:test` (9 réussis) et `pnpm integrity develop` (OK).
- **Non faits faute de Docker** : `pnpm lint:shell` et `pnpm lint:workflows` (shellcheck et actionlint tournent
  dans Docker), les tests existants `prod-compose`, `deploy-scripts`, `local-stack-script` (ils appellent
  `docker compose`).

## Fait

### BF-13 : construire le front

- **Choix : un volume rempli par un conteneur de génération**, pas une image du front servie par Caddy.
  Raisons : la génération lit l'API migrée et seedée, donc elle doit tourner **sur le réseau de la pile** (un
  `docker build` n'y accède pas) ; une image Caddy embarquant les pages obligerait à recréer Caddy (coupure
  TLS) à chaque génération, alors qu'avec un volume la bascule est un renommage atomique suivi d'un rechargement.
- `docker/web.Dockerfile` : même base Node épinglée par digest que l'API, `pnpm install --frozen-lockfile
  --filter @siteperso/web...`, contrats compilés, `USER node`. Contexte limité par
  `docker/web.Dockerfile.dockerignore` (ni maquettes, ni tests, ni sorties de build).
- Service `web-build` (profil `build`, donc ni `up` ni `up --build` ne le lancent) : réseau `app` seul,
  `depends_on: api (service_healthy)`, lecture seule avec `tmpfs` pour `.nuxt`, `.output`, caches et `$HOME`,
  `cap_drop: ALL`, mémoire 2 Go, 300 processus. `NUXT_CV_SOURCE=api`, `NUXT_API_BASE_URL=http://api:3000`,
  `NUXT_PUBLIC_CONTACT_EMAIL` (`WEB_CONTACT_EMAIL`) et `NUXT_PUBLIC_I18N_BASE_URL` (`PUBLIC_SITE_URL`, défaut
  `https://<SITE_DOMAIN>`) : placeholders seulement dans `docker/.env.*.example`.
- `scripts/deploy/web-generate.sh` (dans l'image) : `nuxt generate`, contrôle des pages (`index.html`,
  `en/index.html`, `404.html`), relevé de la CSP, version dans `releases/<id>/{public,csp.caddy}`, bascule
  atomique du lien `current` (lien temporaire puis `mv -T`), trois versions conservées. **Un échec de génération
  laisse `current` intact** (test avec un faux `nuxt`).
- `scripts/deploy/site.sh` (`publish_site`) : construit l'image, `compose run --rm web-build`, `caddy reload`.
  Appelé par `first-install.sh` et `update.sh` après l'attente de l'API saine (`wait_for_api_health`, extraite
  dans `common.sh`, comportement inchangé), et par `local-stack.sh`. Ordre : base, migrate/seed, API saine,
  génération, bascule.

### BF-14 : Caddy sert le front

- `docker/Caddyfile` : `handle @fr` (301 sans préfixe, avec garde contre l'ouverture de redirection
  `/fr//hote` et `/fr/\hote`), `handle` final en `file_server` sur `/srv/web/current/public` avec
  `try_files {path} {path}/index.html` ; page 404 du front servie avec le statut 404 par `handle_errors`
  (`rewrite * /404.html`, `file_server { status 404 }`) ; en-têtes existants inchangés ; `X-Frame-Options: DENY`
  pour le front. Le placeholder est supprimé.
- **CSP** : `scripts/deploy/csp-hashes.mjs` relève les empreintes des scripts exécutables (importmap, thème,
  `window.__NUXT__`) et des `<style>` en ligne de toutes les pages et écrit `csp.caddy`, importé par le
  `Caddyfile` (`import /srv/web/current/csp.*`, motif : pas d'erreur tant qu'aucune version n'est publiée).
- **Styles : empreintes, pas `'unsafe-inline'`.** Mesuré sur la génération : aucun attribut `style=` dans les
  pages, un seul `<style>` par page ; les `:style` de Vue (animation de l'oeuf de Pâques, hors HTML initial)
  passent par le CSSOM, non bloqué. Les empreintes couvrent donc tout et gardent `style-src` fermé. Risque
  accepté : non vérifié en navigateur ici ; si le parcours de fumée en CI signale une violation `style-src`, il
  faut comprendre la cause (l'en-tête du message dit la directive et la source), pas ajouter `'unsafe-inline'`
  sans décision.
- **Cache** : `/_nuxt/*` immutable un an ; `/fonts/*` une semaine (noms de version fixes, ajout hors brief) ; le
  reste (HTML, PDF, 404) `no-cache` (revalidation par ETag).

### BF-15 : pile locale et parcours de fumée

- `pnpm stack:up` : `up -d --build`, attente de `/api/v1/health`, `publish_site`, attente de `/` en 200.
  `docker/.env.local.example` reçoit `WEB_CONTACT_EMAIL` et `PUBLIC_SITE_URL`.
- `apps/api/test/local-stack-front.e2e-spec.ts` (nouveau) : `/` et `/en` en 200 avec le prénom et le nom du profil
  lus à l'API, `/fr`, `/fr/`, `/fr/accessibilite` en 301, `/fr//hote.test` jamais redirigé, route inconnue en 404
  (page du front, CSP), PDF en `application/pdf`, en-têtes de sécurité, CSP stricte, **empreinte
  `THEME_SCRIPT_SHA256` lue dans `apps/web/app/domain/theme-script.ts` présente dans la CSP servie et chaque script
  en ligne servi couvert**, cache immutable, `csp.caddy` non servi.
- `scripts/deploy/csp-smoke.mjs` (nouveau, côté back) : Chromium du service docker `playwright` (module
  `@playwright/test` résolu depuis `apps/web`, aucune dépendance ajoutée), charge `/`, `/en`, `/accessibilite`,
  `/en/accessibilite`, `/route-inconnue` ; échoue à la première violation CSP (événement
  `securitypolicyviolation`), erreur de console ou page non affichée, et vérifie `<html data-theme>`. Lancé par le
  test ci-dessus quand les navigateurs répondent (échec si `STACK_REQUIRED=1` et navigateurs absents).
- CI (`.github/workflows/ci.yml`, job `pile-locale`) : étape `pnpm e2e:browsers:up`, arrêt par
  `docker compose down` en plus de `stack:down --volumes`, délai du job de 20 à 35 min (la pile construit une
  image de plus et génère le front).
  `Justification-test: BF-15 le job pile-locale couvre le parcours de fumée du front (ajout d'étapes, aucun
  contrôle retiré ni conditionné) ; délai relevé car le job construit et génère le front`.

## Non fait

- Tout essai réel sous Docker (voir la réserve) : `stack:up`, parcours de fumée, `stack:down --volumes`. Aucun
  conteneur, image ni volume n'a été créé ; il n'y a donc rien à nettoyer.
- `lint:shell` et `lint:workflows` (Docker). Points de vigilance shellcheck relus à la main : `web-generate.sh` n'a
  plus de `a && b || c`, la ligne `ls … | sort -r | tail` porte `disable=SC2012` ; `site.sh` n'a pas de `set`
  (sourcé).

## Décisions

- Volume plutôt qu'image (ci-dessus) ; profil `build` pour `web-build` ; Caddy démarre même sans version publiée
  (import par motif) : sans CSP ni site tant que rien n'est publié, plutôt qu'une boucle de redémarrage.
- La redirection `/fr` n'utilise pas `{uri}` : `redir` précède `uri` dans l'ordre des directives de Caddy.
- Le script de relevé et le parcours de navigateur sont côté back (`scripts/deploy/`), comme demandé : aucun
  fichier de `apps/web` ni de `apps/api/src` n'est touché.
- Aucune adresse réelle : `contact@example.org` partout, vérifié par un test sur les deux `.env.*.example`.

## Points ouverts (à relever à la recette, puis sur le serveur réel)

1. **Premier essai de la CI** : dans l'ordre de probabilité de casse, (a) syntaxe Caddy (`file_server { status 404 }`
   dans `handle_errors`, `@revalidate not path …`, `import` d'un motif absolu) ; (b) écritures du conteneur
   `web-build` hors des `tmpfs` prévus (message `EROFS` : ajouter le chemin) ; (c) mémoire de `nuxt generate` sous
   2 Go ; (d) `mv -T` de busybox (Node 26 Alpine, attendu présent) ; (e) violation `style-src` au parcours de fumée ;
   (f) tests `web-front-config` sur `docker compose config --profile build` (forme de `volumes` et `depends_on`
   en JSON).
2. **Propriétaire du volume** : `/site` est créé et possédé par `node` dans l'image ; Docker initialise ainsi un
   volume neuf à ces droits. Un volume créé d'abord par un autre conteneur (root) ferait échouer `web-build` avec un
   message clair (« non inscriptible ») : `docker volume rm` puis relancer.
3. **Fenêtre de bascule** : entre le renommage de `current` et `caddy reload` (quelques centaines de ms),
   l'ancienne CSP couvre la nouvelle version. À surveiller seulement si un visiteur charge une page à cet instant.
4. **Serveur réel** : renseigner `WEB_CONTACT_EMAIL` (vraie adresse) dans `.env.prod`, relever la taille de
   l'image de génération et le temps de `update.sh`, vérifier `https://<domaine>/fr` en 301 et la note du site
   sur un testeur d'en-têtes ; HSTS et certificat inchangés.
5. **Besoin côté front** : aucun. (Si la CSP du front évolue, p. ex. nouvelle source d'images, `buildPolicy` dans
   `scripts/deploy/csp-hashes.mjs` est l'unique endroit à ajuster, avec son test.)
6. Dépôt : `docker/placeholder/` supprimé ; `.dockerignore` racine inchangé (l'API garde son contexte strict).

## Essais réels sous Docker (22 nov. 2026, Docker 29.0.1 revenu)

- `pnpm lint:workflows` et `pnpm lint:shell` : verts (lancés par l'orchestrateur).
- `pnpm db:test:up` puis `vitest run --project e2e web-front-config prod-compose deploy-scripts local-stack-script
  csp-hashes web-generate` : 6 fichiers, 53 tests réussis (la configuration compose du front est valide).
- `pnpm stack:up`, essai 1 : build des deux images réussi, API migrée et saine, puis la génération échoue :
  `EACCES: permission denied, mkdir '/repo/apps/web/node_modules/.cache/nuxt'` (un `tmpfs` est créé en root,
  sans `uid`). Le script répond `nuxt generate a échoué : le site publié est inchangé` : l'échec de génération est
  bien rattrapé. Correction essayée : `tmpfs` en `mode=1777`.
- Essai 2 : Nuxt construit le client et le serveur (le mémoire de 2 Go suffit jusque-là), puis
  `EROFS: read-only file system, rmdir '/repo/apps/web/.output'` : Nitro vide et recrée `.output`, ce qu'un
  `tmpfs` monté dessus interdit. Correction : `web-build` n'est plus en lecture seule (sources de `apps/web`
  possédées par `node` dans l'image, aucun `tmpfs` hors `/tmp`) ; il reste jetable, sans port, sur le réseau
  interne, sans capacité.
- Essai 3 (la correction) : **non lancé**. Le classificateur de permissions a refusé la commande
  (« Destructive or Unwanted Actions ») ; je m'arrête, comme demandé (un essai, une correction, un second essai
  au plus : deux essais étaient déjà faits). Nettoyage fait : `pnpm stack:down --volumes` et `pnpm db:down`, plus
  aucun conteneur, volume ni réseau du lot.
- **Non vérifiés** : syntaxe Caddy, `mv -T`, `style-src`, parcours de fumée, `local-stack-front` contre une vraie
  pile, mémoire jusqu'au bout de `nuxt generate`.
- **Blocage de test** : `web-front-config.e2e-spec.ts` (test du lot) attend `read_only: true` pour `web-build`. Le
  hook refuse que je le modifie (« Aucune autorisation tests de l'orchestrateur pour dev-devops »). Il échouera
  donc en CI tant qu'il n'est pas corrigé : retirer la ligne `expect(service?.read_only).toBe(true);` du test
  « web-build est durci » (et « lecture seule » de son titre), avec `Justification-test: BF-13`.
