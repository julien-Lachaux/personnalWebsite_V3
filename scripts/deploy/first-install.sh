#!/usr/bin/env bash
# Premier déploiement sur le VPS. Idempotent : peut être relancé sans effet de bord.
#
# Étapes : vérifie Docker/Compose et que le dépôt est sur main (git flow), crée DEPLOY_DIR, crée .env.prod depuis le modèle (mots de passe
# générés) puis s'arrête pour que l'opérateur le remplisse, construit l'image, lance la pile,
# attend le healthcheck de l'API, affiche l'état.
#
# Codes de sortie : 0 terminé ; 1 erreur ; 10 .env.prod à remplir (relancer ensuite).
set -euo pipefail

# shellcheck source=scripts/deploy/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

require_docker
require_deploy_branch

log "Dossier de déploiement : ${DEPLOY_DIR}"
mkdir -p "${DEPLOY_DIR}"
chmod 700 "${DEPLOY_DIR}"

if [ ! -f "${ENV_FILE}" ]; then
  command -v openssl >/dev/null 2>&1 || die "openssl est introuvable (génération des mots de passe)"
  cp "${REPO_DIR}/docker/.env.prod.example" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  password="$(openssl rand -hex 24)"
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${password}/" "${ENV_FILE}"
  sed -i "s/^API_DB_PASSWORD=.*/API_DB_PASSWORD=$(openssl rand -hex 24)/" "${ENV_FILE}"
  log "${ENV_FILE} créé avec des mots de passe PostgreSQL générés (propriétaire et API en lecture seule)."
  log "Renseigner SITE_DOMAIN et CORS_ORIGIN dans ce fichier, puis relancer ce script."
  exit "${EXIT_NEEDS_ENV}"
fi

ensure_api_db_password

# Le fichier existe : refuser les valeurs du modèle qui n'ont pas été remplacées.
if grep -Eq '^(SITE_DOMAIN=example\.test|CORS_ORIGIN=https://example\.test|POSTGRES_PASSWORD=change-me|API_DB_PASSWORD=change-me)$' "${ENV_FILE}"; then
  log "${ENV_FILE} contient encore des valeurs du modèle (example.test, change-me)."
  log "Les remplacer, puis relancer ce script."
  exit "${EXIT_NEEDS_ENV}"
fi

log "Validation de la configuration compose"
compose config --quiet

log "Construction de l'image de l'API"
run compose build api

log "Démarrage de la pile (migrations et seeds passent par le service migrate)"
run compose up -d

if [ "${DRY_RUN}" = "1" ]; then
  log "Dry-run : attente du healthcheck et état ignorés."
  exit 0
fi

log "Attente du healthcheck de l'API (${HEALTH_TIMEOUT} s max)"
api_id="$(compose ps -q api)"
[ -n "${api_id}" ] || die "le conteneur api n'existe pas"
elapsed=0
until [ "$(docker inspect --format '{{.State.Health.Status}}' "${api_id}")" = "healthy" ]; do
  if [ "${elapsed}" -ge "${HEALTH_TIMEOUT}" ]; then
    compose logs --tail 50 migrate api || true
    die "l'API n'est pas healthy après ${HEALTH_TIMEOUT} s"
  fi
  sleep 3
  elapsed=$((elapsed + 3))
done

log "État de la pile"
compose ps
log "Terminé."
