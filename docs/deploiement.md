# Déploiement en production (VPS)

La production tourne avec `docker/compose.prod.yml` : Caddy (TLS automatique, seul service qui publie
des ports 80/443), l'API (réseaux internes, `TRUST_PROXY=uniquelocal`), un service `migrate` à usage unique
(migrations, seeds, rôle de lecture seule de l'API) et PostgreSQL 16 (volume nommé, aucun port publié). Le front viendra plus tard :
en attendant, Caddy sert `docker/placeholder/index.html` sur `/` et proxifie `/api/*` vers l'API.

## Prérequis

- Un VPS avec Docker et le plugin `docker compose` (rien d'autre : Node est dans l'image).
- Un enregistrement DNS A/AAAA du domaine vers le VPS, ports 80 et 443 ouverts (Caddy obtient le
  certificat tout seul). Pour un essai local, `HTTP_PORT` et `HTTPS_PORT` (dans `.env.prod`) changent les
  ports hôte publiés (défaut 80/443).
- Le dépôt cloné sur le VPS (les scripts se trouvent dans `scripts/deploy/`).

## Premier déploiement

```sh
scripts/deploy/first-install.sh
```

Le script est idempotent. Il vérifie Docker, crée le dossier de déploiement (`DEPLOY_DIR`, par défaut
`/opt/siteperso-v3`, droits 700), puis crée `DEPLOY_DIR/.env.prod` depuis `docker/.env.prod.example` avec un
mot de passe PostgreSQL du propriétaire (`POSTGRES_PASSWORD`) et un mot de passe du rôle de l'API
(`API_DB_PASSWORD`) générés par `openssl rand`. Il s'arrête alors avec le **code de sortie 10** : éditer
`.env.prod` (`SITE_DOMAIN`, `CORS_ORIGIN`, éventuellement `RATE_LIMIT_*`) puis relancer le script. Il
construit l'image, lance la pile, attend que l'API soit `healthy` (`HEALTH_TIMEOUT`, 180 s par défaut) et
affiche l'état.

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
la saute), `git pull --ff-only`, reconstruction de l'image, `compose run --rm migrate` (migrations et seeds),
`compose up -d`. Une migration déjà appliquée ne doit jamais être modifiée : le runner compare les
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

Restauration (la sauvegarde contient `DROP … IF EXISTS`) :

```sh
gunzip -c DEPLOY_DIR/backups/<fichier>.sql.gz | \
  docker compose -f docker/compose.prod.yml --env-file DEPLOY_DIR/.env.prod \
  exec -T postgres psql -U siteperso -d siteperso
```

## Réseaux et durcissement des conteneurs

- Réseaux : `edge` (Caddy : ports publiés, sortie vers Internet pour le certificat), `app` (Caddy et l'API) et
  `data` (l'API, `migrate`, PostgreSQL), ces deux derniers `internal: true`. Caddy ne joint donc pas la base et
  l'API ne peut pas sortir sur Internet. Le futur front se branchera sur `app`.
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

- Sous `/api/*` : toute méthode hors `GET`, `HEAD`, `OPTIONS` reçoit un 405 `application/problem+json` sans
  que le corps soit lu, et tout corps est plafonné à 1 Kio (413). L'API refuse elle aussi les corps > 1 Kio.
- Réponses sans `Server` ni `Via` (le logiciel n'est pas annoncé), y compris la redirection HTTP vers HTTPS
  (écrite à la main dans le `Caddyfile` ; `PUBLIC_HTTPS_PORT`, alimenté par `HTTPS_PORT`, fixe son port).
- `Content-Security-Policy` : `default-src 'none'; frame-ancestors 'none'` sous `/api/*`, `default-src 'self'`
  pour la page statique. À adapter quand le front sera servi.

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

## Essai local de la pile de production

```sh
SITE_DOMAIN=localhost CORS_ORIGIN=https://localhost POSTGRES_PASSWORD=essai API_DB_PASSWORD=essai-api \
  docker compose -f docker/compose.prod.yml up -d --build
curl -sk https://localhost/api/v1/health
docker compose -f docker/compose.prod.yml down -v   # supprime aussi les volumes
```

Caddy émet un certificat interne auto-signé pour `localhost` (d'où `-k`).
