# Déploiement en production (VPS)

La production tourne avec `docker/compose.prod.yml` : Caddy (TLS automatique, seul service qui publie
des ports 80/443), l'API (réseaux internes, `TRUST_PROXY=uniquelocal`), un service `migrate` à usage unique
(migrations, seeds, rôle de lecture seule de l'API) et PostgreSQL 16 (volume nommé, aucun port publié). Le front
statique est généré par un conteneur à usage unique (`web-build`) dans un volume que Caddy sert ; Caddy
proxifie `/api/*` vers l'API (voir « Front statique »).

## Prérequis

- Un VPS avec Docker et le plugin `docker compose` (rien d'autre : Node est dans l'image).
- Un enregistrement DNS A/AAAA du domaine vers le VPS, ports 80 et 443 ouverts (Caddy obtient le
  certificat tout seul). Pour un essai local, `HTTP_PORT` et `HTTPS_PORT` (dans `.env.prod`) changent les
  ports hôte publiés (défaut 80/443).
- Le dépôt cloné sur le VPS **sur la branche `main`** (`git clone --branch main <dépôt>`) ; les scripts se
  trouvent dans `scripts/deploy/`.

## Branche déployée (git flow)

Décision de Julien du 19 nov. 2026 : le dépôt suit git flow. `develop` est la branche d'intégration (les lots
y sont fusionnés, la session principale la pousse) ; elle ne se déploie **jamais**. La production se déploie
depuis `main`, que seul Julien fait avancer : fusion d'une branche `release/*` ou `hotfix/*`, étiquette de
version, push de `main`, puis lancement du déploiement sur le VPS. `first-install.sh` et `update.sh` refusent
(code 1) un dépôt qui n'est pas sur `main` (branche fixée dans `scripts/deploy/common.sh`, non surchargeable) ;
avec `DRY_RUN=1`, ils l'avertissent seulement, pour répéter la procédure depuis une autre branche.

## Premier déploiement

```sh
scripts/deploy/first-install.sh
```

Le script est idempotent. Il vérifie Docker, crée le dossier de déploiement (`DEPLOY_DIR`, par défaut
`/opt/siteperso-v3`, droits 700), puis crée `DEPLOY_DIR/.env.prod` depuis `docker/.env.prod.example` avec un
mot de passe PostgreSQL du propriétaire (`POSTGRES_PASSWORD`) et un mot de passe du rôle de l'API
(`API_DB_PASSWORD`) générés par `openssl rand`. Il s'arrête alors avec le **code de sortie 10** : éditer
`.env.prod` (`SITE_DOMAIN`, `CORS_ORIGIN`, **`WEB_CONTACT_EMAIL`**, éventuellement `RATE_LIMIT_*`) puis relancer le
script. Il construit l'image, lance la pile, attend que l'API soit `healthy` (`HEALTH_TIMEOUT`, 180 s par défaut),
génère le front contre elle et bascule Caddy (voir « Front statique ») puis affiche l'état.

| Code | Sens                                                               |
| ---- | ------------------------------------------------------------------ |
| 0    | terminé                                                            |
| 1    | erreur (Docker absent, configuration invalide, API jamais healthy) |
| 10   | `.env.prod` créé ou encore au modèle : à remplir, puis relancer    |

`DRY_RUN=1` affiche les commandes qui modifient l'état au lieu de les exécuter (utile pour répéter la
procédure avec `DEPLOY_DIR=$(mktemp -d)`).

Vérification : `curl https://<domaine>/api/v1/health` renvoie `{"status":"ok","checks":{"database":"up"}}`.

## Mise à jour

```sh
scripts/deploy/update.sh
```

Sauvegarde préalable (`backup.sh`, l'échec arrête la mise à jour avant toute modification ; `SKIP_BACKUP=1`
la saute), `git pull --ff-only origin main` (le dépôt doit être sur `main`, voir « Branche déployée »),
reconstruction de l'image, `compose run --rm migrate` (migrations et seeds),
`compose up -d`, attente de l'API `healthy`, génération du front et bascule de Caddy (si la génération échoue, le
script s'arrête et le site précédent reste servi). Une migration déjà appliquée ne doit jamais être modifiée : le runner compare les
checksums et échoue (voir `db/README.md`).

## Sauvegarde et restauration

```sh
scripts/deploy/backup.sh          # DEPLOY_DIR/backups/siteperso-AAAAMMJJ-HHMMSS.sql.gz
```

`pg_dump` est exécuté dans le conteneur `postgres` ; les `BACKUP_KEEP` (14) sauvegardes les plus récentes
sont conservées (`BACKUP_KEEP` doit être un entier >= 1, le script refuse toute autre valeur). Pour planifier :
une ligne `crontab` quotidienne appelant le script avec `DEPLOY_DIR`.

**Copie hors du VPS** (indispensable : une sauvegarde sur le disque du VPS ne protège pas de sa perte).
Exemple, une heure après la sauvegarde, vers une machine ou un stockage objet distinct :

```sh
0 3 * * * DEPLOY_DIR=/opt/siteperso-v3 /opt/siteperso-v3/repo/scripts/deploy/backup.sh
0 4 * * * rsync -a --delete /opt/siteperso-v3/backups/ sauvegarde@hote-distant:siteperso-v3/
```

L'image de production ne contient pas `db:reset` (commande destructrice, réservée aux bases de dev et de test).

### Entités supprimées (soft delete)

Une entité qui disparaît des seeds n'est pas supprimée : le seed la marque `deleted_at` et l'API ne la sert
plus (docs/01). Le nettoyage physique est manuel, jamais automatique, avec le rôle propriétaire (comme
`migrate`) :

```sh
# Lister les entités marquées (table, slug, date de marquage) :
docker compose -f docker/compose.prod.yml --env-file DEPLOY_DIR/.env.prod run --rm migrate node dist/cli/deleted-list.js
# Simuler, puis supprimer physiquement celles marquées depuis plus de 30 jours (acquittement requis en production) :
docker compose -f docker/compose.prod.yml --env-file DEPLOY_DIR/.env.prod run --rm migrate node dist/cli/deleted-purge.js --older-than 30
docker compose -f docker/compose.prod.yml --env-file DEPLOY_DIR/.env.prod run --rm -e ALLOW_PRODUCTION_PURGE=yes migrate node dist/cli/deleted-purge.js --older-than 30 --confirm
```

Sans `--confirm`, `deleted-purge` ne fait que simuler. En production, la suppression est refusée sans
`ALLOW_PRODUCTION_PURGE=yes`. Faire une sauvegarde avant (`scripts/deploy/backup.sh`) : la suppression est
définitive. En dev : `pnpm db:deleted:list`, `pnpm db:deleted:purge --older-than 30 [--confirm]`.

Restauration (la sauvegarde contient `DROP … IF EXISTS`) :

```sh
gunzip -c DEPLOY_DIR/backups/<fichier>.sql.gz | \
  docker compose -f docker/compose.prod.yml --env-file DEPLOY_DIR/.env.prod \
  exec -T postgres psql -U siteperso -d siteperso
```

## Front statique (BF-13 à BF-15)

Le front (`apps/web`) est une génération statique (`nuxt generate`) : aucun serveur Node du front en production.
Caddy sert les fichiers générés ; l'API ne sert pas le front.

**Choix : un volume, rempli par un conteneur de génération** (et non une image du front servie par Caddy). La
génération lit le contenu à l'API **migrée et seedée** (`GET /api/v1/cv?lang=`, elle échoue si l'API ne répond
pas) : un `docker build` ne joint pas le réseau interne de la pile (l'API n'est pas joignable pendant le
build, et elle exigerait une base prête), alors qu'un conteneur du réseau `app` l'atteint par `http://api:3000`.
Une image Caddy intégrant les pages obligerait en plus à reconstruire et recréer Caddy (donc couper TLS et
connexions) à chaque génération. Avec un volume, la bascule est un renommage atomique et Caddy ne redémarre pas.

| Élément                      | Rôle                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker/web.Dockerfile`      | image de génération (même base Node que l'API, épinglée par digest, `pnpm install --frozen-lockfile`, utilisateur `node`) ; elle ne sert rien |
| service `web-build`          | profil `build` : `compose up` ne le lance jamais ; réseau `app` seul (joint l'API, jamais la base ni Internet) ; lecture seule, `cap_drop: ALL` |
| volume `web_site`            | écrit par `web-build` (`/site`), lu par Caddy en lecture seule (`/srv/web`)                                                                 |
| `scripts/deploy/web-generate.sh` | dans l'image : génère, contrôle les pages, relève les empreintes CSP, publie `releases/<id>/{public,csp.caddy}`, bascule `current`, garde 3 versions |
| `scripts/deploy/site.sh`     | `publish_site` : construit l'image, joue `compose run --rm web-build`, recharge Caddy ; partagé par `first-install.sh`, `update.sh` et `pnpm stack:up` |

**Ordre au déploiement** : base, migrations et seeds (`migrate`), API `healthy`, génération du front, bascule de
Caddy. `first-install.sh`, `update.sh` et `pnpm stack:up` l'appliquent. Un échec de génération (API injoignable,
adresse de contact vide ou invalide, page attendue absente) arrête le script avant la bascule : le lien `current`
n'a pas bougé et Caddy continue de servir la version précédente (`apps/api/test/web-generate.e2e-spec.ts` le
prouve avec un faux `nuxt`). Retour arrière manuel : `releases/<id précédent>` est conservé (3 versions) ;
repointer `current` puis `caddy reload`.

Variables de génération, toutes dans `.env.prod` (modèle `docker/.env.prod.example`) :

- `WEB_CONTACT_EMAIL` : adresse du bouton « Lancer l'entretien », figée dans les pages à la génération. Le dépôt
  ne contient que `contact@example.org` ; **la vraie adresse se renseigne sur le serveur**. Vide ou invalide, la
  génération échoue.
- `PUBLIC_SITE_URL` (facultatif) : URL publique absolue (canonical, hreflang) ; `https://<SITE_DOMAIN>` par défaut.
  En local avec un port non standard, elle porte ce port (`docker/.env.local.example`).

### Caddy et la CSP du front

- `/api/*` : inchangé (proxy vers l'API). `/fr` et `/fr/*` : 301 vers le même chemin sans préfixe (D15), le premier
  caractère de la suite ne pouvant être `/` ni `\` (sinon `/fr//hote` redirigerait hors du site : ce chemin donne
  la page 404). Le reste : `file_server` sur `/srv/web/current/public`, `try_files {path} {path}/index.html`
  (`/en` répond 200 sans redirection vers `/en/`). Route inconnue : 404 avec la page `404.html` du front (une
  coquille rendue côté client, le statut vient de Caddy).
- En-têtes de tout le site inchangés (HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, pas de `Server`) ;
  sur le front : `X-Frame-Options: DENY` et la CSP.
- **CSP** : `default-src 'self'` ; `script-src 'self'` plus une empreinte par script en ligne ; `style-src 'self'`
  plus une empreinte par `<style>` en ligne ; `img-src 'self' data:` ; `font-src`, `connect-src` en `'self'` ;
  `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`. Aucun domaine tiers.
- Les empreintes changent à chaque génération (carte d'import, `window.__NUXT__`, styles critiques de chaque page).
  `scripts/deploy/csp-hashes.mjs` les relève dans toutes les pages de `.output/public` (le script de thème sans
  flash D5 en fait partie : sa constante `THEME_SCRIPT_SHA256` se retrouve dans la CSP servie, vérifié par
  `local-stack-front.e2e-spec.ts`) et écrit `csp.caddy` à côté de `public/` (pas servi). Le `Caddyfile` l'importe
  depuis `/srv/web/current/csp.*` ; `publish_site` recharge Caddy après la bascule (une fraction de seconde où
  l'ancienne CSP couvre les nouvelles pages : sans effet pour une page déjà chargée).
- **Styles par empreintes, pas `'unsafe-inline'`** : les pages générées n'ont aucun attribut `style=` (les styles
  que Vue pose à l'exécution passent par l'API CSSOM, que la CSP ne bloque pas), et chaque page a un unique bloc
  `<style>` : les empreintes couvrent tout, sans ouvrir l'injection de style. Si une violation `style-src`
  apparaît au parcours de fumée, la réponse est de la comprendre, pas d'ajouter `'unsafe-inline'`.
- **Cache** : `/_nuxt/*` (nom à empreinte) en `public, max-age=31536000, immutable` ; `/fonts/*` (noms de version
  fixes) une semaine ; tout le reste (HTML, PDF, `404.html`) `no-cache` (revalidation par ETag).

### Pages d'erreur serveur (lot 30, branchement au lot 32)

La génération du front produit, à côté de `404.html` et `en/404.html`, une page d'erreur serveur par langue :
`/srv/web/current/public/50x.html` (français) et `/srv/web/current/public/en/50x.html` (anglais). Elles sont
autonomes : aucun script de l'application, aucune charge utile, aucun appel à l'API ; seuls les feuilles de style
de `/_nuxt/*.css`, les polices de `/fonts/` et le script de thème en ligne (haché dans `csp.caddy` comme les
autres éléments en ligne, puisque `csp-hashes.mjs` lit toutes les pages). Elles sont `noindex`, sans canonique et
hors de `sitemap.xml`. Branchées dans `handle_errors` des deux Caddyfile au lot 32 :

- 404 : `404.html` ou `en/404.html` (déjà en place) ; 500, 502, 503 et 504 hors `/api/*` : `50x.html` ou
  `en/50x.html` (chemin d'origine `/en` ou `/en/…`), **par réécriture** (jamais de redirection : « Réessayer »
  recharge l'adresse qui a échoué), avec le statut de l'erreur (`file_server { status {err.status_code} }`), la CSP
  du front et `Cache-Control: no-cache` ;
- `/api/*` : **inchangé** (décision de Julien, le comportement des erreurs serveur de l'API fait l'objet d'un
  ticket séparé). Constaté sur la pile d'essai, API arrêtée : `502 Bad Gateway`, `Content-Type: text/plain;
  charset=utf-8`, corps `502 Bad Gateway`,, jamais la page HTML ;
- aucune erreur 50x n'est produite par le site statique lui-même : ces pages ne servent que quand Caddy ne joint
  plus l'API (et pour les adresses hors `/api/*` qu'une erreur de Caddy atteint) ; le test
  `wip-mode.e2e-spec.ts` les provoque par une route d'essai `/boom/*` ajoutée à une copie du Caddyfile.

### Mode travaux (lot 32)

Ferme le site au public pendant un chantier, sans régénérer le front. Même fonctionnement en local et sur le VPS
(`docker/wip.caddy`, importé par `docker/Caddyfile` et `docker/Caddyfile.vps` ; `docker/caddy-start.sh`, point
d'entrée du conteneur Caddy). Variables de `docker/.env.prod` (et de `docker/.env.local` pour la pile locale) :

| Variable | Rôle |
|---|---|
| `WIP_MODE` | `off` (défaut) ou `on` ; autre valeur : le conteneur refuse de démarrer |
| `WIP_KEY` | clé d'accès, jamais dans le dépôt : 32 caractères au moins parmi `A-Za-z0-9._~-` (`openssl rand -hex 24`) |
| `WIP_STATUS` | statut de la page travaux, 503 par défaut (décision de Julien du 25 nov. 2026) ; `200` pour une page ordinaire |
| `WIP_RETRY_AFTER` | `Retry-After` de la page, en secondes (3600) |
| `WIP_API` | `open` (défaut, décision de Julien) : `/api/*` reste ouverte ; `closed` : 503 `application/problem+json` sans le cookie |

Comportement avec `WIP_MODE=on` : toute adresse hors `/api/*` redirige (302, `Cache-Control: no-store`) vers
`/travaux`, ou `/en/work-in-progress` pour `/en` et `/en/*` ; ces pages répondent 503 avec `Retry-After`,
`X-Robots-Tag: noindex`, la CSP du front et `no-cache`. Passent sans redirection : `/_nuxt/*`, `/_i18n/*`,
`/fonts/*`, `/robots.txt` et les deux `_payload.json` de la page. **Clé** : `/?acces=<clé>` (n'importe quelle page
hors API) pose le cookie `acces` (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`, 30 jours) et
redirige vers la même adresse sans le paramètre ; avec le cookie, le site s'affiche normalement. Clé ou cookie
faux : comportement du mode actif, sans indice. La valeur du cookie est l'empreinte SHA-256 de `wip:<clé>`
(calculée par `caddy-start.sh`, relue par `{file./tmp/wip.token}`), jamais la clé : changer la clé invalide les
cookies. Le paramètre `acces` est retiré de l'URI de chaque entrée du journal d'accès de la pile (`log` en
`format filter`) ; `Cookie` et `Set-Cookie` y sont déjà masqués par Caddy. **Limite** : le Caddy de l'hôte (VPS) voit
l'adresse avant la pile et journalise son URI : y appliquer le même filtre (bloc ci-dessous), sinon la clé s'écrit
dans le journal de l'hôte.

Procédure (compte de l'appli, dans `DEPLOY_DIR`) :

```sh
# Activer : éditer .env.prod (WIP_MODE=on et WIP_KEY=$(openssl rand -hex 24)), puis recréer le seul Caddy.
# Les variables de Caddy sont fixées à la création du conteneur : un `caddy reload` ne les relit pas.
docker-compose -f docker/compose.prod.yml -f docker/compose.vps.yml --env-file .env.prod up -d caddy
# Désactiver : WIP_MODE=off (ou retirer la ligne), même commande. Changer la clé : nouvelle WIP_KEY, même commande.
# Contrôle : curl -sI https://<domaine>/ doit donner 302 (actif) ou 200 (éteint).
```

Le site n'est pas régénéré (le volume `web_site` ne change pas) ; la recréation de Caddy dure quelques secondes.
`WIP_MODE=on` avec une clé absente ou trop courte : Caddy s'arrête avec « WIP_MODE=on exige une clé WIP_KEY d'au
moins 32 caractères » (`docker-compose logs caddy`), la pile n'est jamais à moitié protégée.

### Pages d'erreur quand la pile est arrêtée (Caddy de l'hôte, à reporter dans `add-app.sh`)

Pile entière arrêtée, le Caddy de l'hôte ne joint plus le socket : il répond 502. Il peut servir une copie
statique des pages 50x et de leurs ressources, posée dans un dossier de l'hôte lisible par `caddy` (hors du
dossier 700 de l'appli), mise à jour à chaque déploiement. Bloc à ajouter au site de l'hôte (à côté de son
`reverse_proxy unix//run/prod/site-perso/web.sock`) :

```caddyfile
	log {
		format filter {
			wrap json
			fields {
				request>uri query {
					delete acces
				}
			}
		}
	}
	handle_errors {
		header -Server
		@assets path /_nuxt/* /fonts/*
		handle @assets {
			root * /srv/site-perso-errors
			file_server
		}
		@down expression {err.status_code} in [502, 503, 504]
		handle @down {
			root * /srv/site-perso-errors
			header Cache-Control "no-cache"
			header X-Robots-Tag "noindex"
			@en vars_regexp en {http.request.orig_uri.path} ^/en(?:/|$)
			rewrite * /50x.html
			rewrite @en /en/50x.html
			file_server {
				status {err.status_code}
			}
		}
	}
```

Le bloc `log` remplace celui de l'hôte s'il existe déjà (il ajoute seulement le filtre de la clé). Pas de CSP posée
par l'hôte : la page est servie sans, et le script de thème en ligne s'exécute.
Copie, à ajouter à `update.sh` côté hôte (ou à lancer après chaque `update.sh`, dossier créé une fois en 0755 par
l'administrateur et appartenant à l'appli) :

```sh
docker-compose -f docker/compose.prod.yml -f docker/compose.vps.yml --env-file .env.prod exec -T caddy \
  tar -C /srv/web/current/public -cf - 50x.html en/50x.html _nuxt fonts \
  | tar -C /srv/site-perso-errors -xf -
chmod -R a+rX /srv/site-perso-errors
```

### Parcours de fumée du front (BF-15)

`pnpm stack:up` construit l'API et l'image de génération, migre et seede, génère le front contre l'API saine,
recharge Caddy puis attend `/` en 200. `apps/api/test/local-stack-front.e2e-spec.ts` (même détection de la pile que
`local-stack.e2e-spec.ts`) vérifie : `/` et `/en` en 200 avec le contenu de l'API, `/fr` en 301, route inconnue en
404 (page du front), `/cv/cv-fr.pdf` en `application/pdf`, la CSP (présente, stricte, empreintes de chaque script
en ligne servi), les en-têtes de cache. Avec les navigateurs démarrés (`pnpm e2e:browsers:up`),
`scripts/deploy/csp-smoke.mjs` charge `/`, `/en`, `/accessibilite`, `/en/accessibility` et une route inconnue dans
Chromium (service `playwright`, version de `@playwright/test` d'`apps/web`) et échoue à la première violation CSP,
erreur de console ou page non affichée ; il vérifie aussi que le script de thème a tourné (`<html data-theme>`).
Le job CI `pile-locale` lance les deux (`STACK_REQUIRED=1`).

## Réseaux et durcissement des conteneurs

- Réseaux : `edge` (Caddy : ports publiés, sortie vers Internet pour le certificat), `app` (Caddy, l'API et `web-build`) et
  `data` (l'API, `migrate`, PostgreSQL), ces deux derniers `internal: true`. Caddy ne joint donc pas la base et
  l'API ne peut pas sortir sur Internet.
- Chaque conteneur : système de fichiers racine en lecture seule (`tmpfs` pour `/tmp`), `cap_drop: ALL` (Caddy
  garde `NET_BIND_SERVICE`, PostgreSQL les capacités de son entrypoint), `no-new-privileges`, `mem_limit` et
  `pids_limit`.
- Image de l'API : code et `node_modules` à root (en lecture seule pour l'utilisateur `node`), ni npm, ni yarn,
  ni `wget`/`nc` dans l'image, pas de `db:reset`.
- `apps/api/test/prod-compose.e2e-spec.ts` vérifie ces propriétés sur la configuration résolue par compose.

## IP des clients et rate limiting

L'API compte le quota par IP cliente, lue dans `X-Forwarded-For` ajouté par Caddy (`TRUST_PROXY=uniquelocal`).
Les clients IPv6 sont regroupés par préfixe /64 (`ipv6Subnet`). **À vérifier après le premier déploiement** :
sur certains hôtes Docker, le trafic IPv6 est relayé par `docker-proxy` et Caddy voit alors la même adresse
privée (`172.x.0.1`) pour tous ces visiteurs, qui partageraient un seul quota (constaté sous WSL, jamais
observé sur le trafic IPv4 d'un VPS Linux, qui garde son IP source).

```sh
# 1. Depuis une machine en IPv6, quelques requêtes :
curl -6 https://<domaine>/api/v1/health
# 2. Sur le VPS, l'adresse vue par Caddy (champ request.remote_ip, ou client_ip) :
docker compose -f docker/compose.prod.yml --env-file DEPLOY_DIR/.env.prod logs caddy | grep '"uri":"/api/v1/health"' | tail -3
```

**Variante VPS sous Podman (lot 29)** : la faiblesse RS-4 est levée par construction. En rootless, l'IP source
est perdue (rootlesskit) sur un réseau compose : c'est le Caddy de l'hôte qui reçoit les clients (IPv4 et IPv6) et
transmet leur adresse par `X-Forwarded-For` ; le Caddy de la pile la croit (`trusted_proxies_unix`), l'API la lit
(`TRUST_PROXY=uniquelocal`). Prouvé en essai (`bash scripts/deploy/vps-stack.sh up`, puis
`apps/api/test/vps-stack.e2e-spec.ts`) : deux clients d'adresses distinctes ont chacun leur quota (le second garde
200 quand le premier atteint 429, même avec un `X-Forwarded-For` forgé) et le journal de la pile porte leurs
adresses. La vérification IPv4/IPv6 réelle reste à faire une fois sur le serveur (`curl -4` puis `curl -6`, journal
`/var/log/caddy/site-perso.access.log` de l'hôte et journal de la pile).

Si l'adresse affichée est une `172.x.0.1` (ou `::ffff:172.x.0.1`) au lieu de l'IP publique du client : les
visiteurs IPv6 partagent un quota. Corrections possibles, à choisir selon l'hôte : désactiver le proxy
utilisateur de Docker (`"userland-proxy": false` dans `/etc/docker/daemon.json`, puis redémarrer Docker) ou
activer l'IPv6 sur le réseau `edge` (`enable_ipv6: true` avec un sous-réseau). Consigner ici le résultat de la
vérification. Le journal d'accès contient des adresses IP : sa rotation est bornée (3 fichiers de 10 Mo).

## Ce que Caddy filtre et annonce

- Parité développement / production (docs/02) : sous `/api/*`, Caddy laisse passer toutes les requêtes à
  l'API, qui répond elle-même, à l'identique en dev et en prod. Une méthode hors `GET`, `HEAD`, `OPTIONS`
  sur une route existante reçoit de l'API un 405 `application/problem+json` avec `Allow: GET, HEAD,
  OPTIONS` ; sur une route inconnue, un 404. Tout corps est plafonné à 1 Kio (Caddy, et l'API en double).
- Réponses sans `Server` ni `Via` (le logiciel n'est pas annoncé), y compris la redirection HTTP vers HTTPS
  (écrite à la main dans le `Caddyfile` ; `PUBLIC_HTTPS_PORT`, alimenté par `HTTPS_PORT`, fixe son port).
- En-têtes de sécurité sous `/api/*` : `X-Frame-Options: DENY` et `Content-Security-Policy: default-src
  'none';frame-ancestors 'none'` sont posés par l'API (helmet). Le `Caddyfile` les double avec les mêmes
  valeurs et le préfixe `?` (posé seulement si l'API ne l'a pas fait) : jamais deux valeurs divergentes.
  Pour la page statique : `default-src 'self'` et `X-Frame-Options: SAMEORIGIN`. À adapter quand le front
  sera servi.

### Écart connu entre développement et production

Un seul écart est connu sur les réponses de l'API : une URL mal encodée (`/api/%zz`) est rejetée par Caddy
avant l'API, en `400 text/plain`, alors que l'API seule répond en `400 application/problem+json`. Aucun
réglage de Caddy ne produit du problem+json pour cette erreur : l'écart est accepté et consigné ici.
Les réponses que Caddy produit lui-même (`502` si l'API est arrêtée, `413` text/plain quand un corps dépasse
son plafond de 1 Kio, mesuré lors de l'essai du lot 9) sont des réponses d'infrastructure en texte brut, hors
du comportement de l'API. **Tranché par Julien le 19 nov. 2026** : ces trois écarts (400, 413, 502) sont
acceptés et ne seront pas corrigés côté Caddy ; le front traite toute réponse non JSON comme une erreur
générique.

## Production sous Podman sans privilèges (lot 29)

Décision de Julien (25 nov. 2026) : **Caddy en deux niveaux**. Le serveur (Debian 13, Podman 5.4 sans privilèges,
`docker-compose` 2.26 parlant à l'API de Podman par `DOCKER_HOST=unix:///run/user/<uid>/podman/podman.sock`) fait
tourner l'appli sous le compte `app-site-perso`, sans sudo, dossier `/srv/apps/site-perso`. Un compte non root ne
peut pas lier 80/443 : le **Caddy de l'hôte** (paquet officiel) tient 80/443, le TLS (Let's Encrypt), la redirection
HTTP vers HTTPS et des en-têtes par défaut (préfixe `?` : ceux de la pile l'emportent), puis relaie vers le socket
Unix `/run/prod/site-perso/web.sock`. Le **Caddy de la pile** (frontal de l'appli) écoute ce socket, sert le front,
la CSP, `/fr`, `/api/*` (plafond de corps de 1 Kio) : même site que `docker/Caddyfile`, vérifié identique par
`prod-vps.e2e-spec.ts`. Aucun port n'est publié.

Fichiers : `docker/compose.vps.yml` (surcharge de `compose.prod.yml`, sans `ports`, sans `NET_BIND_SERVICE`, sans
réseau `edge`, noms d'image complets, `restart: always`, `oom_score_adj`), `docker/Caddyfile.vps`
(`bind unix//run/prod/web.sock|0660`, `servers { trusted_proxies_unix }`, `auto_https off`). Pas de `user:` sur le
Caddy de la pile : seul le root du conteneur (le compte de l'appli sur l'hôte) crée le socket dans le dossier 2750.

Variables du compte de l'appli (environnement de la session ou de `~/.profile`) :

```sh
export DEPLOY_DIR=/srv/apps/site-perso     # clone du dépôt, .env.prod, sauvegardes
export DEPLOY_COMPOSE=docker-compose       # Compose v2 (Go) ; défaut « docker compose »
export DEPLOY_INSPECT="podman inspect"     # défaut « docker inspect »
export DEPLOY_VARIANT=vps                  # ajoute docker/compose.vps.yml
export DEPLOY_WEB_BUILD=podman             # le front se construit par podman build (docker-compose ignore
                                           # web.Dockerfile.dockerignore : pas de BuildKit)
```

Procédure (Julien, sous `app-site-perso`) : cloner le dépôt sur `main`, exporter ces variables, lancer
`bash scripts/deploy/first-install.sh` (code 10 : remplir `.env.prod`, relancer), puis `update.sh` à chaque mise à
jour. Relance au démarrage : `restart: always` (relancé par `podman-restart.service`). Vérifier ensuite :
`curl -I https://<domaine>/api/v1/health`, `curl -4`/`curl -6`, `docker-compose … ps`, et l'absence de `ports`
(`docker-compose -f docker/compose.prod.yml -f docker/compose.vps.yml --env-file … config | grep -c published`
doit afficher 0).

Contrôles rootless (essai sur Podman 6.2 sans privilèges, poste de développement) : `mem_limit` et `pids_limit`
fonctionnent (cgroups délégués : cpu, memory, pids ; pas io) ; `cap_add` de PostgreSQL (CHOWN, DAC_OVERRIDE, FOWNER,
SETGID, SETUID) et `cap_drop: ALL` ailleurs, volumes nommés et réseaux `internal` fonctionnent. Sans `oom_score_adj`
explicite, tout `exec` échoue (`exit status 126`, healthcheck « unhealthy ») : constaté de nouveau. La variante fixe
donc PostgreSQL à 300 (tué en dernier : seule une valeur supérieure à celle du conteneur est permise sans privilège),
l'API, Caddy et migrate à 500, la génération du front (2 Go) à 900. À retester sur Podman 5.4.2 du serveur
(`podman inspect` du conteneur et un `exec`).

Essai local de la variante : `bash scripts/deploy/vps-stack.sh up | ps | logs | exec | down` (frontal simulé et deux
clients, `docker/compose.vps-frontal.yml`, rien n'est publié) ; `VPS_STACK_EXTRA_FILE` ajoute un fichier compose
(`restart: 'no'` tant qu'une pile n'a pas démarré une fois). Le test `vps-stack.e2e-spec.ts` rejoue l'IP réelle et le
quota par client sur cette pile ; il n'est pas encore branché dans la CI (modification de `ci.yml` à autoriser :
`up`, `vitest run --project e2e vps-stack` avec `VPS_STACK_REQUIRED=1`, `down`).

## Rôles PostgreSQL

Deux rôles, pour que l'API en lecture seule ne puisse rien écrire même si elle est compromise :

- `siteperso` (`POSTGRES_PASSWORD`) : superutilisateur de l'image PostgreSQL, propriétaire du schéma.
  Utilisé par le service `migrate` (migrations, seeds) et par `backup.sh` (`pg_dump`). L'API ne le voit pas.
- `siteperso_api` (`API_DB_PASSWORD`) : `login`, ni superutilisateur ni propriétaire, `select` seul sur les
  tables du schéma `public` (présentes et futures). Créé ou mis à jour à chaque déploiement par
  `node dist/cli/provision-api-role.js` (dernière étape du service `migrate`) ; c'est le rôle de
  `DATABASE_URL` du service `api`. Il ne peut ni écrire, ni créer d'objet, ni exécuter `copy … program`.

Un déploiement antérieur sans `API_DB_PASSWORD` : `update.sh` le génère dans `.env.prod`, puis `migrate`
crée le rôle. Vérification : `docker compose … exec postgres psql -U siteperso -d siteperso -c "select
rolname, rolsuper from pg_roles where rolname like 'siteperso%'"`.

## Secrets

Aucun secret n'est versionné : `.env.prod` vit dans `DEPLOY_DIR`, hors du dépôt, en droits 600. Le fichier
`docker/.env.prod.example` ne contient que des placeholders.

## Pile locale complète

Objectif (décision du 19 novembre 2026) : reproduire sur le poste tout comportement observé en production. La
pile locale **est** la pile de production : mêmes `docker/compose.prod.yml`, `docker/Caddyfile` et images
`siteperso-api:prod` (`docker/api.Dockerfile`) et `siteperso-web-build:prod` (`docker/web.Dockerfile`). Il n'existe ni second compose ni second Caddyfile ;
la variation locale tient dans un seul fichier d'environnement, `docker/.env.local` (copie ignorée par git de
`docker/.env.local.example`).

```sh
pnpm stack:up                    # crée docker/.env.local si besoin (mots de passe générés), construit les images,
                                 # démarre, attend /api/v1/health, génère le front, attend / via Caddy
pnpm stack:ps                    # état des conteneurs (migrate apparaît « Exited (0) » : normal)
pnpm stack:logs [service]        # journaux (Caddy : journal d'accès JSON)
pnpm stack:down                  # arrête et supprime conteneurs et réseaux, garde la base et les certificats
pnpm stack:down --volumes        # supprime aussi la base et les certificats de Caddy (option explicite)
curl -sk https://localhost:8443/api/v1/health
curl -sk -o /dev/null -w '%{http_code}\n' https://localhost:8443/   # le front : 200
```

Les scripts sont `scripts/deploy/local-stack.sh` (`DRY_RUN=1` affiche les commandes sans les lancer ;
`STACK_ENV_FILE` choisit un autre fichier d'environnement). Aucune variable à taper : les secrets locaux sont
tirés au hasard à la première exécution et restent dans `docker/.env.local` (droits 600, jamais commité). Si
la base locale existe déjà et que ce fichier est supprimé, faire `pnpm stack:down --volumes` avant de relancer.
Plusieurs piles (worktrees) : un `COMPOSE_PROJECT_NAME` et des ports distincts dans chaque `.env.local`.

### Différences entre local et production

Toutes passent par `docker/.env.local` ; aucune ne modifie un fichier compose ou le `Caddyfile`.

| Élément                  | Production                      | Local                                    | Raison                                                                 |
| ------------------------ | ------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| Nom de projet compose    | `siteperso-v3-prod`             | `siteperso-v3-local` (`COMPOSE_PROJECT_NAME`) | conteneurs, réseaux et volumes séparés de ceux d'une prod sur la même machine |
| Ports hôte               | 80 et 443                       | 8080 et 8443 (`HTTP_PORT`, `HTTPS_PORT`) | ports privilégiés et souvent occupés sur un poste                      |
| Domaine (`SITE_DOMAIN`)  | nom de domaine public           | `localhost`                              | pas de DNS public ; Caddy émet un certificat interne                   |
| Certificat TLS           | Let's Encrypt                   | autorité interne de Caddy (auto-signé)   | aucune validation ACME possible pour `localhost` (voir ci-dessous)     |
| `CORS_ORIGIN`            | `https://<domaine>`             | `https://localhost:8443`                 | l'origine suit le domaine et le port                                   |
| Mots de passe PostgreSQL | secrets du serveur              | générés au hasard, propres au poste      | aucun secret réel hors du serveur                                      |
| Contact et URL du front  | `WEB_CONTACT_EMAIL` réelle, `https://<domaine>` | `contact@example.org`, `https://localhost:8443` (`PUBLIC_SITE_URL`) | la vraie adresse n'est jamais dans le dépôt |
| `alt-svc` (HTTP/3)       | `h3=":443"` correct             | annonce `:443` alors que le port publié est 8443 | Caddy annonce son port interne ; sans effet pour curl (HTTP/1.1 et 2) |
| Sauvegardes, `restart`   | `backup.sh`, `unless-stopped`   | non planifiées ; `restart` identique     | scripts de déploiement réservés au serveur                             |
| Quota (`RATE_LIMIT_*`)   | 100 par 60 s                    | idem                                     | volontairement identique : le 429 se reproduit avec 100 requêtes      |

Rien d'autre ne diffère : même image, mêmes réseaux `edge`/`app`/`data`, mêmes durcissements, mêmes en-têtes,
mêmes rôles PostgreSQL. La limite connue côté IP cliente (trafic IPv6 relayé par `docker-proxy`, voir « IP des
clients et rate limiting ») vaut aussi en local : toutes les requêtes viennent de la passerelle Docker, donc
d'une seule IP pour le quota.

### Certificat

Caddy émet pour `localhost` un certificat signé par sa propre autorité interne. Sans rien installer :
`curl -k`. Pour que le navigateur ou `curl` lui fassent confiance (optionnel, action volontaire de
l'opérateur sur son poste), extraire le certificat racine de l'autorité depuis le volume de Caddy puis
l'importer dans le magasin de confiance de la machine ou du navigateur :

```sh
docker compose -f docker/compose.prod.yml --env-file docker/.env.local cp \
  caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
curl --cacert ./caddy-root.crt https://localhost:8443/api/v1/health
```

Ce certificat est propre à la pile locale : le retirer du magasin avec la pile (`stack:down --volumes`).

### Scénarios de reproduction

Chaque scénario est rejoué automatiquement par `apps/api/test/local-stack.e2e-spec.ts` (voir plus bas).
Ports d'exemple : 8443 (HTTPS) et 8080 (HTTP).

Si le port 8080 (ou 8443) est déjà pris sur le poste, changer `HTTP_PORT` et `HTTPS_PORT` dans `docker/.env.local`, puis aligner `CORS_ORIGIN` sur le nouveau port HTTPS (`https://localhost:<HTTPS_PORT>`) et relancer `pnpm stack:up`. Les commandes ci-dessous s'adaptent en remplaçant les ports d'exemple.

| #   | Scénario                         | Commande                                                                                     | Réponse attendue                                                                                                                                  |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lecture nominale                 | `curl -ski https://localhost:8443/api/v1/profile`                                            | 200 `application/json` ; un seul `x-frame-options: DENY` et un seul `content-security-policy: default-src 'none';frame-ancestors 'none'` ; ni `server` ni `via` |
| 2   | Méthode d'écriture               | `curl -ski -X POST https://localhost:8443/api/v1/profile`                                    | 405 `application/problem+json`, `allow: GET, HEAD, OPTIONS` (réponse de l'API, identique en dev)                                                  |
| 3   | Corps de 2 Kio                   | `head -c 2048 /dev/zero \| tr '\0' a \| curl -ski -X POST --data-binary @- https://localhost:8443/api/v1/profile` | 413 `text/plain` produit par Caddy (plafond 1 Kio) : **écart documenté**                                                         |
| 4   | Route inconnue                   | `curl -ski https://localhost:8443/api/v1/inconnue`                                           | 404 `application/problem+json`                                                                                                                    |
| 5   | URL mal encodée                  | `curl -ski --http1.1 --path-as-is 'https://localhost:8443/api/%zz'`                          | 400 `text/plain` produit par Caddy : **écart documenté** (en HTTP/2, curl signale une erreur de flux, code 92)                                    |
| 6   | HTTP vers HTTPS                  | `curl -si 'http://localhost:8080/api/v1/profile?a=1'`                                        | 301 `Location: https://localhost:8443/api/v1/profile?a=1`, sans `server`                                                                          |
| 7   | Quota dépassé                    | `for i in $(seq 105); do curl -sk -o /dev/null -w '%{http_code}\n' https://localhost:8443/api/v1/health; done \| sort \| uniq -c` | 100 fois 200 puis 429 `application/problem+json` avec `retry-after` (le quota se libère après 60 s)                                               |
| 8   | API arrêtée                      | `docker compose -f docker/compose.prod.yml --env-file docker/.env.local stop api` puis `curl -ski https://localhost:8443/api/v1/profile` | 502 `text/plain` produit par Caddy : **écart documenté** ; redémarrer avec `start api`                                           |
| 9   | Rôle PostgreSQL en lecture seule | `docker compose … exec postgres psql -U siteperso_api -d siteperso -c 'create table t (i int)'` | `ERROR: permission denied for schema public`                                                                                                      |
| 10  | Réseaux internes                 | `docker compose … exec caddy nc -z -w 3 postgres 5432` ; `exec api node -e "require('node:net').connect(443,'1.1.1.1').on('error',e=>console.log(e.code))"` | le premier échoue (Caddy ne joint pas la base) ; le second n'aboutit pas (l'API ne sort pas sur Internet)                                          |

Les scénarios 1 à 10 contre une pile démarrée : `pnpm --filter @siteperso/api exec vitest run --project e2e
local-stack`. Sans pile (pas de `docker/.env.local`, ou aucune réponse sur son port), un test unique
l'indique et réussit : `pnpm check` reste utilisable sur un poste qui n'a pas la pile. Avec
`STACK_REQUIRED=1`, l'absence de la pile fait échouer ce test (c'est le réglage de la CI). Le scénario 7
épuise le quota : le fichier d'essai attend la fin de la fenêtre avant de commencer, et le scénario 8 termine
en redémarrant l'API, qui remet le quota à zéro.

### Images

Les images construites pour la pile s'appellent `siteperso-api:prod` et `siteperso-web-build:prod`, comme en
production : `stack:up` les reconstruit à chaque lancement (le cache de couches les rend quasi instantanées si
rien n'a changé). Elles peuvent rester sur le poste après `stack:down` ; `docker image rm siteperso-api:prod
siteperso-web-build:prod` les supprime.

## Protection des branches et des étiquettes

Décisions de Julien du 21 nov. 2026 : flux par pull requests vers `develop`, revue automatisée de chaque PR
(job `Revue PR (Claude)` de `.github/workflows/ci.yml`, depuis le lot 22) et `develop` protégée ; le 25 nov. 2026,
`main` et les étiquettes de version le sont aussi. Les hooks des agents refusent `gh api` en écriture : c'est
Julien qui pose ces réglages. Ils sont versionnés dans `docs/github/rulesets/` (section « Rulesets » plus bas).

### Déclencheurs de la CI (lot 22)

Décision de Julien du 21 nov. 2026 : « on ne lance jamais deux fois les tests sur un même lot ». `ci.yml` tourne sur
`pull_request` (vers `develop` et vers `main`), sur `push` de `main` seulement (hotfix poussés directement : CI
informative après coup) et sur `workflow_dispatch` (amorçage de la mutation). Plus aucun push de `develop`, `lot/**`,
`release/**`, `hotfix/**` ni d'étiquette ne la lance. Les jobs requis tournent en parallèle ; le premier qui échoue
annule tout le run (lot 26, L26-02) : le job `arret-premier-echec`, lancé en parallèle, sans checkout et seul à
porter `actions: write`, lit les jobs du run toutes les 15 s (trois tentatives par lecture ; une API injoignable
donne un avertissement, jamais un job rouge) et, dès qu'un job requis est conclu `failure` ou `timed_out`, écrit un
résumé puis lance `gh run cancel`. Le job fautif est déjà terminé : il reste « en échec », les autres sont annulés.
La mutation, la revue et ce job ne sont pas surveillés. La revue Claude (`needs:` sur tous les jobs requis, même workflow, pas de
`workflow_run`) ne démarre qu'une fois la CI verte. La mutation est complète avec seuils sur les PR vers `main`,
incrémentale et informative ailleurs.

### Dependabot désactivé

Décision de Julien du 21 nov. 2026 : les mises à jour de versions passent par nos lots (règle « versions
toujours récentes »), `.github/dependabot.yml` est supprimé et `pnpm audit --prod --audit-level=high` du job
`Qualité` reste le filet pour les vulnérabilités. Ce que Julien fait dans GitHub (les agents n'ont pas le droit de
supprimer une branche distante) :

- _Settings > Advanced Security_ (ou _Code security_) : désactiver « Dependabot security updates » (sinon GitHub
  ouvre encore des PR de correctif sans fichier de configuration) et, s'il le souhaite, garder « Dependabot alerts »
  (alertes seules, sans PR) ; ne pas activer « Dependabot version updates ».
- Fermer les PR Dependabot ouvertes, puis supprimer lui-même les branches distantes `dependabot/…`
  (_Code > Branches_, onglet « All branches », corbeille ; ou `git push origin --delete <branche>` depuis son poste).

### Secret de la revue automatisée

Secret de dépôt `CLAUDE_CODE_OAUTH_TOKEN` : jeton Claude Code de l'abonnement Max de Julien (entrée
`claude_code_oauth_token` de l'action). La clé d'API Anthropic n'est plus utilisée. Marche à suivre :

1. Dans son terminal, connecté à son compte Max : `claude setup-token`. Le jeton s'affiche une seule fois.
2. `gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo julien-Lachaux/personnalWebsite_V3` (la valeur est demandée au
   clavier), ou _Settings > Secrets and variables > Actions > New repository secret_.

Le jeton ne passe jamais dans une commande, un fichier ni une conversation. La revue consomme les limites de
l'abonnement Max, partagées avec son usage interactif. Sans ce secret, le contrôle « Revue PR (Claude) » échoue.

Suivi de la consommation : chaque run écrit coût équivalent, tours, durée et modèle dans son résumé (étape
« Consommation de la revue ») ; pour plusieurs runs, passer leurs résultats JSON à
`node scripts/ci/review-usage.mjs` (fichier ou entrée standard, rien n'est appelé par le script).

### Rulesets

Les quatre rulesets du dépôt sont versionnés, au format d'import et d'export de GitHub, dans
`docs/github/rulesets/`. Ils font foi : un changement passe d'abord par ces fichiers (pull request), puis Julien le
reporte sur GitHub.

| Fichier | Nom sur GitHub | Type | Cible | Contournement |
|---|---|---|---|---|
| `develop.json` | Protection de develop | ruleset de branche | `refs/heads/develop` | aucun, administrateurs compris |
| `main.json` | Protection de main | ruleset de branche | `refs/heads/main` | rôle Admin (`bypass_mode: always`) : push direct d'un correctif urgent par Julien |
| `main-integrite.json` | Intégrité de main | ruleset de branche | `refs/heads/main` | aucun, administrateurs compris |
| `tags-version.json` | Protection des étiquettes de version | ruleset d'étiquettes | `refs/tags/v*` | aucun |

`main` porte deux rulesets (GitHub applique l'union des règles). Raison (revue de la PR #21) : `bypass_mode: always`
lève **toutes** les règles du ruleset pour le rôle Admin, et tout jeton d'API au nom de Julien en hérite, y compris
celui de la session principale. « Protection de main » ne garde donc que ce qu'un correctif urgent doit pouvoir
contourner (PR obligatoire et contrôles requis) ; « Intégrité de main », sans contournement, interdit à tous la
suppression et le push forcé. Le push direct d'un correctif reste permis : c'est une avance rapide. Un administrateur
peut encore pousser ou fusionner sur `main` sans PR ni CI : contre la session principale, seuls les hooks l'arrêtent
(push de `main`, `gh pr merge --admin`).

Règles des rulesets de branche :

- suppression et push forcé interdits (`deletion`, `non_fast_forward`) : dans `develop.json` et
  `main-integrite.json` ;
- pull request obligatoire, 0 approbation (l'auteur ne peut pas approuver sa propre PR : la « revue requise » est
  le contrôle automatisé), fusion par commit de merge seulement (`allowed_merge_methods: ["merge"]`, ni squash ni
  rebase) ;
- contrôles requis, noms exacts des jobs (une matrice donne un contrôle par valeur), sans exiger une branche à
  jour (`strict_required_status_checks_policy: false`) :
  - communs aux deux branches, quatorze : `Qualité (format, lint, typecheck, build, tests)`,
    `Garde-fous (intégrité des tests, hooks des agents)`, `Tests e2e et couverture 100 % (PostgreSQL 16)`,
    `Front (lint, typecheck, couverture 100 %)`, les sept `Front parcours Playwright + axe (<projet>)` (mobile-390,
    tablette-834, portable-1024, desktop-1280, grand-1440, fullhd-1920, ultra-3440),
    `Analyse statique (actionlint des workflows, shellcheck des scripts)`, `Image Docker de l'API (build sans push)`,
    `Pile locale complète (Caddy, API, front, PostgreSQL) et scénarios de production` ;
  - `develop` ajoute `Revue PR (Claude)` (le job ne tourne que vers `develop`) ;
  - `main` ajoute `Contrôle de la release` (`release.yml` ; ignoré, donc vert, hors branche `release/*`).
- Jamais requis : `Test par mutation (contrats|API|front)` (informatif) et `Arrêt au premier échec` (il annule le
  run au premier échec mais se termine toujours en succès : le requérir ne protégerait rien).
- Une PR issue d'un fork ou en brouillon ne saute pas « Revue PR (Claude) » (un job sauté compte comme réussi) : le
  job échoue avec un message clair, sans lancer l'action ni utiliser le secret.

Ruleset d'étiquettes : une étiquette `v*` ne peut être ni supprimée ni déplacée (`deletion`, `update`). Sa création
reste libre : `release.yml` la pose avec le `GITHUB_TOKEN`, et les hooks refusent déjà toute étiquette aux sessions.

Un job renommé dans `ci.yml` ou `release.yml` impose de mettre à jour ces fichiers dans la même pull request, et le
ruleset en ligne dans un ordre précis. Mis à jour trop tard, le contrôle requis attend un job qui n'existe plus et la
PR du renommage reste bloquée ; trop tôt, ce sont les autres PR ouvertes (encore sur l'ancien nom) qui bloquent.
Donc : la PR du renommage passe la CI (ses nouveaux contrôles tournent), puis Julien met le ruleset à jour juste
avant de la fusionner, et les autres PR ouvertes sont remises à jour sur `develop`.

Poser ou mettre à jour (Julien) :

1. _Settings > Rules > Rulesets > New ruleset > Import a ruleset_, un fichier à la fois, relire, _Create_. Pour
   mettre à jour un ruleset existant, le supprimer puis réimporter le fichier, ou reporter la différence à la main.
   En ligne de commande, l'équivalent est
   `gh api --method POST repos/julien-Lachaux/personnalWebsite_V3/rulesets --input docs/github/rulesets/<fichier>`.
2. Ne pas garder de protection de branche classique (_Settings > Branches_) à côté des rulesets : une seule source.
3. Un nom de contrôle qui n'a jamais tourné est accepté à l'import ; il n'est vérifié qu'à la première PR qui le
   produit (cas de `Contrôle de la release` avant la première release).

À l'import, GitHub complète la règle `pull_request` de deux champs absents des fichiers : `required_reviewers: []`
(sans effet) et `require_extra_approval_for_unattributed_changes: true`. Ce dernier n'a pas été observé à l'œuvre :
si une fusion est refusée faute d'approbation alors que la CI est verte, c'est lui qu'il faut décocher.

Vérification (lecture seule) : `gh api repos/julien-Lachaux/personnalWebsite_V3/rulesets` liste les rulesets ;
`gh api repos/julien-Lachaux/personnalWebsite_V3/rulesets/<id>` donne le détail à comparer au fichier. Constaté le
25 nov. 2026 : les quatre rulesets sont actifs et conformes aux fichiers, aux deux champs ajoutés près, et `main` n'a
plus de protection classique. `gh api repos/julien-Lachaux/personnalWebsite_V3/rules/branches/main` montre chaque
règle appliquée à `main` avec le ruleset qui la porte (`deletion` et `non_fast_forward` par « Intégrité de main »).

### Décisions de Julien (21 nov. 2026)

- La règle s'applique aussi aux administrateurs : `bypass_actors` vide (ou `enforce_admins: true`). La session
  principale fusionne par `gh pr merge --merge`, sans `--admin` ; en cas d'urgence, Julien désactive
  temporairement le ruleset.
- Quinze contrôles requis (lot 22) : les jobs de `ci.yml` hors mutation (dont les e2e de l'API, le job front de qualité et les sept parcours Playwright, un par taille d'écran) et `Revue PR (Claude)`.
- « Revue requise » = le contrôle `Revue PR (Claude)`, sans approbation humaine (un compte ne peut pas approuver
  sa propre PR).

### Décisions de Julien (25 nov. 2026)

- `main` est protégée aux mêmes règles que `develop`, réparties en deux rulesets : PR obligatoire et contrôles
  requis contournables par le rôle Admin, qui garde le push direct d'un correctif urgent ; suppression et push forcé
  interdits à tous, sans contournement (revue de la PR #21).
- Les étiquettes `v*` sont protégées contre la suppression et le déplacement.
- Les rulesets sont versionnés dans `docs/github/rulesets/` : rien de secret dans ces fichiers (noms de jobs,
  règles, rôle Admin par son identifiant générique 5).
- Les contributions externes restent permises (pas de limite d'interaction : GitHub ne les propose que pour 6 mois
  au plus, c'est un outil de modération temporaire). Une pull request externe ne peut rien sans Julien : ses
  workflows attendent son approbation, la fusion exige la CI verte et seul un compte avec droit d'écriture (Julien)
  fusionne. Pas d'approbation requise dans les rulesets : elle bloquerait les PR de lot, ouvertes sous le compte de
  Julien.

### Réglages de sécurité du dépôt (RSP-1)

Posés ou constatés le 25 nov. 2026 (revue `docs/revues/securite-pre-publication-2026-11-19.md`, RSP-1). Ils ne sont
pas versionnables : les relire par `gh api` (lecture seule) après tout changement de réglage.

| Réglage | Valeur | Où | Lecture |
|---|---|---|---|
| Approbation des workflows de PR de fork | tous les contributeurs externes | _Settings > Actions > General_ | `gh api repos/julien-Lachaux/personnalWebsite_V3/actions/permissions/fork-pr-contributor-approval` → `all_external_contributors` |
| Permissions par défaut du `GITHUB_TOKEN` | lecture ; Actions ne crée ni n'approuve de PR | _Settings > Actions > General_ | `…/actions/permissions/workflow` → `read`, `false` |
| Secret scanning et push protection | activés | _Settings > Advanced Security_ | `gh api repos/julien-Lachaux/personnalWebsite_V3 --jq .security_and_analysis` |
| Signalement privé de vulnérabilités | activé (canal indiqué par `SECURITY.md`) | _Settings > Advanced Security_ | `…/private-vulnerability-reporting` → `enabled: true` |
| Limites d'interaction | aucune (décision ci-dessus) | _Settings > Moderation_ | — |
| Double authentification du compte de Julien | active (confirmée par Julien) | paramètres du compte | — |

La règle de relecture des PR externes (chemins dont le code s'exécute sur le poste ou au déploiement, SQL relu ligne
à ligne) est dans `SECURITY.md`, à la racine.

### Premier run du test par mutation (informatif)

Le job `mutation` est une matrice par paquet (L20-04), chaque paquet avec son cache d'incrément
`stryker-incremental-<paquet>-…` et son délai (contrats 30 min, front 30 min, API 150 min). L'incrément de l'API
n'est écrit qu'à la fin d'un run complet : le premier run (cache vide) l'amorce, sans pousser de commit
supplémentaire grâce à _Actions > CI > Run workflow_ (`workflow_dispatch`) sur `develop`. Voir
`docs/comptes-rendus/lot-20-devops.md` pour ce que ce premier run doit montrer.

Lot 22 : le run complet avec seuils ne dépend plus des étiquettes `v*` mais des pull requests vers `main`
(`MUTATION_FULL` dans `ci.yml`) ; vers `develop` il reste incrémental. Aucun push sur `develop` n'alimente plus le
cache d'incrément : l'amorçage se fait par `workflow_dispatch` sur `develop`, puis les PR le restaurent depuis leur base.

## Version et changelog

Décisions de Julien du 21 nov. 2026 (lot 23). Une seule source de vérité : les Conventional Commits. Aucun
robot n'écrit sur `main` ni sur une branche de release ; l'étiquette ne vient que du workflow
`.github/workflows/release.yml` (les hooks refusent toute étiquette aux sessions).

### Calcul de la version

`scripts/ci/release.mjs` (Node et git, rien à installer, testé par `scripts/ci/tests/release.test.sh`) lit
les commits depuis la dernière étiquette `v*` (la plus haute en semver, pas la plus récente, même si elle
n'est pas dans l'historique de la branche) : `feat` donne une mineure, `fix` et `perf` un correctif, `!` après
le type ou un pied `BREAKING CHANGE:` une majeure. Les commits de fusion et `chore(release)` sont ignorés ;
`docs`, `chore`, `test`, `ci`, `build`, `refactor` et `style` ne déclenchent rien et n'entrent pas au
changelog (sauf s'ils sont incompatibles). Sans `feat`, `fix`, `perf` ni rupture, il n'y a rien à publier
(`pnpm release:next` échoue). Le changelog `CHANGELOG.md` est en français : « Changements incompatibles »,
« Nouveautés », « Corrections », « Performances ».

Première version : sans aucune étiquette, la version est `3.0.0` (V3 du site), avec une section d'introduction
sans liste de commits (l'historique est dans git). Elle s'amorce par le même chemin que les suivantes.

### Procédure (session principale, puis Julien)

1. Depuis `develop` à jour : `v=$(pnpm -s release:next)`, puis `git switch -c release/$v develop`.
2. `pnpm release:prepare --commit --trailer 'Co-Authored-By: …'` : écrit `CHANGELOG.md`, passe la `version`
   du `package.json` racine à `$v` (les paquets du monorepo restent privés à `0.0.0`) et commite
   `chore(release): $v`. Rejouable : la section de la version est remplacée, pas dupliquée.
3. Pousser `release/$v` et ouvrir la pull request vers `main` (règle déjà en place, lot 22).
4. Le job `Contrôle de la release` vérifie que la branche, la version calculée, le `package.json` et le
   changelog concordent et que l'étiquette n'existe pas. Si des commits ont été ajoutés qui changent la version
   (un `feat` après un correctif, par exemple), il échoue : relancer l'étape 2 et pousser.
5. Julien relit le changelog dans la pull request et la fusionne (commit de merge). Le job `Étiquette et release`
   pose alors `v$v` sur le commit de merge et crée la release GitHub avec la section du changelog.
6. Julien déploie ensuite comme décrit plus haut.

Le job de contrôle est ignoré (donc vert) hors branche `release/*` : Julien peut l'ajouter aux contrôles requis
de `main` sans bloquer les autres pull requests.

### Hotfix poussé directement sur `main`

Un push sur `main` n'étiquette que si la version du `package.json` est supérieure à la dernière étiquette,
n'est pas déjà étiquetée **et** a sa section dans `CHANGELOG.md`. Un hotfix qui ne touche ni l'un ni l'autre ne
crée donc aucune étiquette : il part avec la prochaine release, dont le changelog le reprend (ses commits
`fix` sont postérieurs à la dernière étiquette ; penser à rapatrier `main` dans `develop`, sinon le prochain
calcul, fait depuis `develop`, ne le voit pas). Pour étiqueter un hotfix tout de suite, Julien exécute
`pnpm release:prepare --any-branch --commit` dans le même push : la version, le changelog et l'étiquette
suivent.

### Limite : l'étiquette ne déclenche aucun autre workflow

Une étiquette créée avec le `GITHUB_TOKEN` ne lance aucun workflow (protection de GitHub contre les boucles).
Un déploiement automatique « sur étiquette » (L14-05) ne partirait donc pas. Options, sans rien implémenter :

- enchaîner le déploiement dans `release.yml` (un job `needs: etiquette`, ou un workflow appelé par
  `workflow_call`) : sans jeton supplémentaire, le plus simple ;
- remplacer le `GITHUB_TOKEN` par un jeton d'une GitHub App (installation limitée au dépôt, `contents: write`) :
  l'étiquette lance alors les workflows sur `push: tags`, mais il faut créer l'App et stocker sa clé en secret ;
- garder l'étiquette passive et lancer le déploiement à la main (`workflow_dispatch` ou script du VPS), comme
  aujourd'hui.
