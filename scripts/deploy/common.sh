#!/usr/bin/env bash
# Fonctions et variables communes aux scripts de déploiement (à sourcer, pas à exécuter).
#
# Variables d'environnement reconnues :
#   DEPLOY_DIR  dossier de déploiement qui porte .env.prod et les sauvegardes (défaut /opt/siteperso-v3)
#   DRY_RUN=1   n'exécute aucune commande docker qui modifie l'état : les affiche seulement

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/siteperso-v3}"
ENV_FILE="${DEPLOY_DIR}/.env.prod"
COMPOSE_FILE="${REPO_DIR}/docker/compose.prod.yml"
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

# Commande docker compose de production.
compose() {
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
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
  command -v docker >/dev/null 2>&1 || die "docker est introuvable"
  docker compose version >/dev/null 2>&1 || die "le plugin « docker compose » est introuvable"
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
