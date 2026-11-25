#!/usr/bin/env bash
# Fonctions et variables communes aux scripts de déploiement (à sourcer, pas à exécuter).
#
# Variables d'environnement reconnues :
#   DEPLOY_DIR  dossier de déploiement qui porte .env.prod et les sauvegardes (défaut /opt/siteperso-v3)
#   DRY_RUN=1   n'exécute aucune commande docker qui modifie l'état : les affiche seulement
#   DEPLOY_COMPOSE  commande compose, mots séparés par des espaces (défaut « docker compose » ; sur le VPS
#               sous Podman sans privilèges : « docker-compose », qui parle à l'API de Podman par DOCKER_HOST)
#   DEPLOY_INSPECT  commande d'inspection d'un conteneur (défaut « docker inspect » ; VPS : « podman inspect »)
#   DEPLOY_VARIANT  vide (défaut : docker/compose.prod.yml seul) ou « vps » (ajoute docker/compose.vps.yml :
#               aucun port publié, Caddy de la pile derrière celui de l'hôte par un socket Unix)
#   DEPLOY_WEB_BUILD  vide (compose construit l'image du front) ou « podman » (`podman build` avec son fichier
#               d'exclusion : docker-compose construit sans BuildKit et ignorerait docker/web.Dockerfile.dockerignore)

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/siteperso-v3}"
ENV_FILE="${DEPLOY_DIR}/.env.prod"
COMPOSE_FILE="${REPO_DIR}/docker/compose.prod.yml"
DEPLOY_COMPOSE="${DEPLOY_COMPOSE:-docker compose}"
DEPLOY_INSPECT="${DEPLOY_INSPECT:-docker inspect}"
DEPLOY_VARIANT="${DEPLOY_VARIANT:-}"
DEPLOY_WEB_BUILD="${DEPLOY_WEB_BUILD:-}"
DRY_RUN="${DRY_RUN:-0}"

# Branche de production (git flow, décision de Julien du 19 nov. 2026) : la production se déploie
# depuis main, jamais depuis develop ni depuis une branche de travail. Volontairement non
# surchargeable.
DEPLOY_BRANCH=main

# Codes de sortie documentés (docs/deploiement.md)
EXIT_NEEDS_ENV=10 # .env.prod créé ou incomplet : l'opérateur doit le remplir puis relancer
export EXIT_NEEDS_ENV

log() { printf '[deploy] %s\n' "$*"; }
die() {
  printf '[deploy] ERREUR : %s\n' "$*" >&2
  exit 1
}

# Commande compose de production (DEPLOY_COMPOSE, variante DEPLOY_VARIANT).
compose() {
  local cmd files=(-f "${COMPOSE_FILE}")
  read -r -a cmd <<<"${DEPLOY_COMPOSE}"
  case "${DEPLOY_VARIANT}" in
  vps) files+=(-f "${REPO_DIR}/docker/compose.vps.yml") ;;
  esac
  "${cmd[@]}" "${files[@]}" --env-file "${ENV_FILE}" "$@"
}

# Inspection d'un conteneur (DEPLOY_INSPECT).
inspect_container() {
  local cmd
  read -r -a cmd <<<"${DEPLOY_INSPECT}"
  "${cmd[@]}" "$@"
}

# Exécute la commande, ou l'affiche seulement en DRY_RUN=1.
run() {
  if [ "${DRY_RUN}" = "1" ]; then
    log "(dry-run) $*"
  else
    "$@"
  fi
}

require_docker() {
  local cmd
  case "${DEPLOY_VARIANT}" in
  '' | vps) ;;
  *) die "DEPLOY_VARIANT invalide : « ${DEPLOY_VARIANT} » (vide ou vps)" ;;
  esac
  case "${DEPLOY_WEB_BUILD}" in
  '' | podman) ;;
  *) die "DEPLOY_WEB_BUILD invalide : « ${DEPLOY_WEB_BUILD} » (vide ou podman)" ;;
  esac
  read -r -a cmd <<<"${DEPLOY_COMPOSE}"
  [ "${#cmd[@]}" -gt 0 ] || die "DEPLOY_COMPOSE est vide"
  command -v "${cmd[0]}" >/dev/null 2>&1 || die "${cmd[0]} est introuvable (DEPLOY_COMPOSE)"
  "${cmd[@]}" version >/dev/null 2>&1 || die "« ${DEPLOY_COMPOSE} » ne répond pas à « version »"
  read -r -a cmd <<<"${DEPLOY_INSPECT}"
  [ "${#cmd[@]}" -gt 0 ] || die "DEPLOY_INSPECT est vide"
  command -v "${cmd[0]}" >/dev/null 2>&1 || die "${cmd[0]} est introuvable (DEPLOY_INSPECT)"
}

# Refuse un dépôt qui n'est pas sur la branche de production (en DRY_RUN=1 : avertit seulement,
# pour pouvoir répéter la procédure depuis n'importe quelle branche).
require_deploy_branch() {
  local current
  current="$(git -C "${REPO_DIR}" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  [ "${current}" = "${DEPLOY_BRANCH}" ] && return 0
  current="${current:-HEAD détachée ou dépôt git absent}"
  if [ "${DRY_RUN}" = "1" ]; then
    log "(dry-run) dépôt sur « ${current} », pas sur ${DEPLOY_BRANCH} : une vraie exécution s'arrêterait ici"
    return 0
  fi
  die "dépôt sur « ${current} » : la production se déploie depuis ${DEPLOY_BRANCH} uniquement (git -C ${REPO_DIR} switch ${DEPLOY_BRANCH})"
}

require_env_file() {
  [ -f "${ENV_FILE}" ] || die "${ENV_FILE} est absent : lancer d'abord scripts/deploy/first-install.sh"
}

# Génère API_DB_PASSWORD dans .env.prod s'il manque (déploiement antérieur au rôle de lecture seule
# `siteperso_api`) : le service migrate crée alors le rôle avec ce mot de passe.
ensure_api_db_password() {
  if grep -Eq '^API_DB_PASSWORD=.+' "${ENV_FILE}"; then
    return 0
  fi
  command -v openssl >/dev/null 2>&1 || die "openssl est introuvable (génération du mot de passe)"
  if [ "${DRY_RUN}" = "1" ]; then
    log "(dry-run) API_DB_PASSWORD absent de ${ENV_FILE} : serait généré"
    return 0
  fi
  printf 'API_DB_PASSWORD=%s\n' "$(openssl rand -hex 24)" >>"${ENV_FILE}"
  log "API_DB_PASSWORD généré dans ${ENV_FILE} (rôle PostgreSQL de lecture seule de l'API)"
}

# Attend que le conteneur de l'API soit « healthy » (HEALTH_TIMEOUT secondes, défaut 180).
wait_for_api_health() {
  local timeout="${HEALTH_TIMEOUT:-180}" api_id elapsed=0
  if [ "${DRY_RUN}" = "1" ]; then
    log "(dry-run) attendrait le healthcheck de l'API"
    return 0
  fi
  log "Attente du healthcheck de l'API (${timeout} s max)"
  api_id="$(compose ps -q api)"
  [ -n "${api_id}" ] || die "le conteneur api n'existe pas"
  until [ "$(inspect_container --format '{{.State.Health.Status}}' "${api_id}")" = "healthy" ]; do
    if [ "${elapsed}" -ge "${timeout}" ]; then
      compose logs --tail 50 migrate api || true
      die "l'API n'est pas healthy après ${timeout} s"
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
}
