# Déploiement en production (VPS)

La production tourne avec `docker/compose.prod.yml` : Caddy (TLS automatique, seul service qui publie
des ports 80/443), l'API (réseau interne, `TRUST_PROXY=true`), un service `migrate` à usage unique
(migrations puis seeds) et PostgreSQL 16 (volume nommé, aucun port publié). Le front viendra plus tard :
en attendant, Caddy sert `docker/placeholder/index.html` sur `/` et proxifie `/api/*` vers l'API.

## Prérequis

- Un VPS avec Docker et le plugin `docker compose` (rien d'autre : Node est dans l'image).
- Un enregistrement DNS A/AAAA du domaine vers le VPS, ports 80 et 443 ouverts (Caddy obtient le
  certificat tout seul).
- Le dépôt cloné sur le VPS (les scripts se trouvent dans `scripts/deploy/`).

## Premier déploiement

```sh
scripts/deploy/first-install.sh
```

Le script est idempotent. Il vérifie Docker, crée le dossier de déploiement (`DEPLOY_DIR`, par défaut
`/opt/siteperso-v3`, droits 700), puis crée `DEPLOY_DIR/.env.prod` depuis `docker/.env.prod.example` avec un
mot de passe PostgreSQL généré par `openssl rand`. Il s'arrête alors avec le **code de sortie 10** : éditer
`.env.prod` (`SITE_DOMAIN`, `CORS_ORIGIN`, éventuellement `RATE_LIMIT_*`) puis relancer le script. Il
construit l'image, lance la pile, attend que l'API soit `healthy` (`HEALTH_TIMEOUT`, 180 s par défaut) et
affiche l'état.

| Code | Sens                                                                |
| ---- | ------------------------------------------------------------------- |
| 0    | terminé                                                             |
| 1    | erreur (Docker absent, configuration invalide, API jamais healthy) |
| 10   | `.env.prod` créé ou encore au modèle : à remplir, puis relancer     |

`DRY_RUN=1` affiche les commandes qui modifient l'état au lieu de les exécuter (utile pour répéter la
procédure avec `DEPLOY_DIR=$(mktemp -d)`).

Vérification : `curl https://<domaine>/api/v1/health` renvoie `{"status":"ok","checks":{"database":"up"}}`.

## Mise à jour

```sh
scripts/deploy/update.sh
```

`git pull --ff-only`, reconstruction de l'image, `compose run --rm migrate` (migrations et seeds),
`compose up -d`. Une migration déjà appliquée ne doit jamais être modifiée : le runner compare les
checksums et échoue (voir `db/README.md`).

## Sauvegarde et restauration

```sh
scripts/deploy/backup.sh          # DEPLOY_DIR/backups/siteperso-AAAAMMJJ-HHMMSS.sql.gz
```

`pg_dump` est exécuté dans le conteneur `postgres` ; les `BACKUP_KEEP` (14) sauvegardes les plus récentes
sont conservées. Pour planifier : une ligne `crontab` quotidienne appelant le script avec `DEPLOY_DIR`.
Copier régulièrement les sauvegardes hors du VPS.

Restauration (la sauvegarde contient `DROP … IF EXISTS`) :

```sh
gunzip -c DEPLOY_DIR/backups/<fichier>.sql.gz | \
  docker compose -f docker/compose.prod.yml --env-file DEPLOY_DIR/.env.prod \
  exec -T postgres psql -U siteperso -d siteperso
```

## Secrets

Aucun secret n'est versionné : `.env.prod` vit dans `DEPLOY_DIR`, hors du dépôt, en droits 600. Le fichier
`docker/.env.prod.example` ne contient que des placeholders.

## Essai local de la pile de production

```sh
SITE_DOMAIN=localhost CORS_ORIGIN=https://localhost POSTGRES_PASSWORD=essai \
  docker compose -f docker/compose.prod.yml up -d --build
curl -sk https://localhost/api/v1/health
docker compose -f docker/compose.prod.yml down -v   # supprime aussi les volumes
```

Caddy émet un certificat interne auto-signé pour `localhost` (d'où `-k`).
