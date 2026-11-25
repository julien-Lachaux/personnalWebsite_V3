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
hors de `sitemap.xml`. Branchement attendu dans `handle_errors` (non fait au lot 30) :

- pour les statuts 500, 502, 503 et 504, servir `50x.html` (ou `en/50x.html` quand le chemin d'origine est `/en`
  ou commence par `/en/`, même règle que la 404) **en gardant le statut de l'erreur** (`file_server` avec
  `status {err.status_code}`), avec la CSP du front (`import /srv/web/current/csp.*`) et `Cache-Control:
  no-cache` ;
- la servir par **réécriture**, jamais par redirection : le lien « Réessayer » de la page (`href=""`) recharge
  l'adresse affichée, qui doit rester celle qui a échoué ;
- le cas des réponses de `/api/*` (502 quand l'API est arrêtée : page HTML ou réponse brute pour un client JSON)
  est à trancher au lot 32.

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

## Protection de develop

Décisions de Julien du 21 nov. 2026 : flux par pull requests vers `develop`, revue automatisée de chaque PR
(job `Revue PR (Claude)` de `.github/workflows/ci.yml`, depuis le lot 22) et `develop` protégée. Les hooks des
agents refusent `gh api` en écriture : c'est Julien qui pose ces réglages, une fois.

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

### Règles à poser

- Pull request obligatoire pour modifier `develop` (pas de push direct), sans approbation humaine exigée
  (0 approbation : l'auteur ne peut pas approuver sa propre PR, la « revue requise » est le contrôle
  automatisé ci-dessous).
- Contrôles requis (noms exacts des jobs, à l'identique de `ci.yml`, quinze contrôles depuis le lot 22) :
  - `Qualité (format, lint, typecheck, build, tests)`
  - `Garde-fous (intégrité des tests, hooks des agents)`
  - `Tests e2e et couverture 100 % (PostgreSQL 16)`
  - `Front (lint, typecheck, couverture 100 %)`
  - `Front parcours Playwright + axe (mobile-390)`
  - `Front parcours Playwright + axe (tablette-834)`
  - `Front parcours Playwright + axe (portable-1024)`
  - `Front parcours Playwright + axe (desktop-1280)`
  - `Front parcours Playwright + axe (grand-1440)`
  - `Front parcours Playwright + axe (fullhd-1920)`
  - `Front parcours Playwright + axe (ultra-3440)`
  - `Analyse statique (actionlint des workflows, shellcheck des scripts)`
  - `Image Docker de l'API (build sans push)`
  - `Pile locale complète (Caddy, API, PostgreSQL) et scénarios de production`
  - `Revue PR (Claude)`
- La mutation (`Test par mutation (contrats|API|front)`) n'est PAS requise : elle reste informative.
- Une PR issue d'un fork ou en brouillon ne saute pas « Revue PR (Claude) » (un job sauté compte comme réussi) : le job échoue avec un message clair, sans lancer l'action ni utiliser le secret.
- Push forcé et suppression de `develop` interdits.

### Forme 1 : ruleset par `gh api` (recommandée)

`bypass_actors` est vide : la règle s'applique aussi aux administrateurs (voir la question plus bas). Pour que
les administrateurs puissent la contourner, remplacer `[]` par
`[{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always"}]` (rôle Admin).

```sh
gh api --method POST repos/julien-Lachaux/personnalWebsite_V3/rulesets --input - <<'JSON'
{
  "name": "Protection de develop",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/develop"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "Qualité (format, lint, typecheck, build, tests)" },
          { "context": "Garde-fous (intégrité des tests, hooks des agents)" },
          { "context": "Tests e2e et couverture 100 % (PostgreSQL 16)" },
          { "context": "Front (lint, typecheck, couverture 100 %)" },
          { "context": "Front parcours Playwright + axe (mobile-390)" },
          { "context": "Front parcours Playwright + axe (tablette-834)" },
          { "context": "Front parcours Playwright + axe (portable-1024)" },
          { "context": "Front parcours Playwright + axe (desktop-1280)" },
          { "context": "Front parcours Playwright + axe (grand-1440)" },
          { "context": "Front parcours Playwright + axe (fullhd-1920)" },
          { "context": "Front parcours Playwright + axe (ultra-3440)" },
          { "context": "Analyse statique (actionlint des workflows, shellcheck des scripts)" },
          { "context": "Image Docker de l'API (build sans push)" },
          { "context": "Pile locale complète (Caddy, API, PostgreSQL) et scénarios de production" },
          { "context": "Revue PR (Claude)" }
        ]
      }
    }
  ]
}
JSON
```

Variante : la protection de branche classique (`PUT repos/julien-Lachaux/personnalWebsite_V3/branches/develop/protection`)
offre les mêmes réglages (`required_pull_request_reviews`, `required_status_checks.contexts`,
`allow_force_pushes: false`, `allow_deletions: false`, `enforce_admins: true`), mais un ruleset se liste, se teste
(`enforcement: evaluate`) et se modifie plus facilement.

### Forme 2 : interface GitHub

_Settings > Rules > Rulesets > New ruleset > New branch ruleset_ : nom « Protection de develop », _Enforcement
status_ Active, _Bypass list_ vide, _Target branches_ > _Add target_ > _Include by pattern_ `develop`. Cocher
_Restrict deletions_, _Block force pushes_, _Require a pull request before merging_ (0 approbation requise),
_Require status checks to pass_ (ajouter les quinze noms ci-dessus ; un nom n'est proposé qu'après avoir tourné au
moins une fois sur une PR), laisser _Require branches to be up to date_ décoché. _Create_.

### Décisions de Julien (21 nov. 2026)

- La règle s'applique aussi aux administrateurs : `bypass_actors` vide (ou `enforce_admins: true`). La session
  principale fusionne par `gh pr merge --merge`, sans `--admin` ; en cas d'urgence, Julien désactive
  temporairement le ruleset.
- Quinze contrôles requis (lot 22) : les jobs de `ci.yml` hors mutation (dont les e2e de l'API, le job front de qualité et les sept parcours Playwright, un par taille d'écran) et `Revue PR (Claude)`.
- « Revue requise » = le contrôle `Revue PR (Claude)`, sans approbation humaine (un compte ne peut pas approuver
  sa propre PR).

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
