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

require_env_file() {
  [ -f "${ENV_FILE}" ] || die "${ENV_FILE} est absent : lancer d'abord scripts/deploy/first-install.sh"
}
