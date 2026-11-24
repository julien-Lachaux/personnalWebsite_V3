#!/usr/bin/env bash
# Pile locale complète : docker/compose.prod.yml + docker/Caddyfile + images de l'API et du front, sans rien dupliquer.
# Seules les variables de docker/.env.local (copie ignorée par git de docker/.env.local.example) changent.
#
# Usage : local-stack.sh up | logs [service…] | ps | down [--volumes]
#
# Variables d'environnement reconnues :
#   STACK_ENV_FILE      fichier d'environnement (défaut docker/.env.local, créé depuis le modèle s'il manque)
#   DRY_RUN=1           affiche les commandes compose qui modifient l'état au lieu de les exécuter
#   CONTAINER_ENGINE    podman ou docker (défaut : docker s'il est installé, sinon podman ; scripts/container-engine.sh)
#   STACK_WAIT_SECONDS  délai d'attente de /api/v1/health puis de la page d'accueil via Caddy (défaut 180)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${REPO_DIR}/docker/compose.prod.yml"
EXAMPLE_FILE="${REPO_DIR}/docker/.env.local.example"
ENV_FILE="${STACK_ENV_FILE:-${REPO_DIR}/docker/.env.local}"
DRY_RUN="${DRY_RUN:-0}"
# shellcheck source=scripts/container-engine.sh
source "${REPO_DIR}/scripts/container-engine.sh"
WAIT_SECONDS="${STACK_WAIT_SECONDS:-180}"

log() { printf '[stack] %s\n' "$*"; }
die() {
  printf '[stack] ERREUR : %s\n' "$*" >&2
  exit 1
}
usage() {
  printf 'Usage : %s up | logs [service…] | ps | down [--volumes]\n' "$(basename "$0")" >&2
}

# Commande compose de la pile, construite par init_compose. Le nom de projet est passé par `-p` (prioritaire) :
# une COMPOSE_PROJECT_NAME déjà présente dans le shell ou un `.env` racine (worktrees en parallèle) prime sinon
# sur celle du fichier d'environnement de la pile.
COMPOSE=()
init_compose() {
  local name=""
  if [ -f "${ENV_FILE}" ]; then
    name="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "${ENV_FILE}" | tail -n 1)"
  fi
  COMPOSE=("${ENGINE}" compose)
  if [ -n "${name}" ]; then
    COMPOSE+=(-p "${name}")
  fi
  COMPOSE+=(-f "${COMPOSE_FILE}")
  if [ "${ENGINE}" = podman ]; then
    COMPOSE+=(-f "${REPO_DIR}/docker/compose.podman.yml")
  fi
  COMPOSE+=(--env-file "${ENV_FILE}")
}

# Fonctions attendues par site.sh (publication du front, partagée avec le déploiement).
# Sous podman, docker-compose construit sans BuildKit : il ignore docker/web.Dockerfile.dockerignore
# et prendrait le .dockerignore racine (celui de l'API), sans le front. L'image du front est alors
# construite par `podman build`, avec son propre fichier d'exclusion et le nom attendu par compose.
compose() {
  if [ "${ENGINE}" = podman ] && [ "$*" = "build web-build" ]; then
    podman build \
      --file "${REPO_DIR}/docker/web.Dockerfile" \
      --ignorefile "${REPO_DIR}/docker/web.Dockerfile.dockerignore" \
      --tag siteperso-web-build:prod \
      "${REPO_DIR}"
    return
  fi
  "${COMPOSE[@]}" "$@"
}

run() {
  if [ "${DRY_RUN}" = "1" ]; then
    log "(dry-run) $*"
  else
    "$@"
  fi
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
  else
    head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

# Crée docker/.env.local depuis le modèle, avec des mots de passe propres à ce poste.
ensure_env_file() {
  if [ -f "${ENV_FILE}" ]; then
    return 0
  fi
  [ -f "${EXAMPLE_FILE}" ] || die "modèle introuvable : ${EXAMPLE_FILE}"
  if [ "${DRY_RUN}" = "1" ]; then
    log "(dry-run) créerait ${ENV_FILE} depuis le modèle"
    return 0
  fi
  local owner_password api_password
  owner_password="$(random_secret)"
  api_password="$(random_secret)"
  (
    umask 077
    sed \
      -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${owner_password}/" \
      -e "s/^API_DB_PASSWORD=.*/API_DB_PASSWORD=${api_password}/" \
      "${EXAMPLE_FILE}" >"${ENV_FILE}"
  )
  log "créé ${ENV_FILE} (mots de passe générés, fichier ignoré par git)"
}

env_value() { sed -n "s/^$1=//p" "${ENV_FILE}" | tail -n 1; }

wait_for_health() {
  local port url deadline
  port="$(env_value HTTPS_PORT)"
  url="https://localhost:${port:-8443}/api/v1/health"
  deadline=$((SECONDS + WAIT_SECONDS))
  log "attente de ${url}"
  until curl -sk --max-time 3 -o /dev/null -f "${url}"; do
    if [ "${SECONDS}" -ge "${deadline}" ]; then
      "${COMPOSE[@]}" ps --all >&2 || true
      die "la pile ne répond pas après ${WAIT_SECONDS} s (voir : pnpm stack:logs)"
    fi
    sleep 2
  done
  log "pile prête : ${url} (certificat interne : curl -k)"
}

# shellcheck source=scripts/deploy/site.sh
. "$(dirname "${BASH_SOURCE[0]}")/site.sh"

# Le front est généré contre l'API (donc après sa santé) puis servi par Caddy : la page d'accueil répond 200.
wait_for_front() {
  local port url deadline
  port="$(env_value HTTPS_PORT)"
  url="https://localhost:${port:-8443}/"
  deadline=$((SECONDS + WAIT_SECONDS))
  until curl -sk --max-time 3 -o /dev/null -f "${url}"; do
    if [ "${SECONDS}" -ge "${deadline}" ]; then
      "${COMPOSE[@]}" ps --all >&2 || true
      die "le front ne répond pas après ${WAIT_SECONDS} s (voir : pnpm stack:logs)"
    fi
    sleep 2
  done
  log "front prêt : ${url}"
}

command="${1:-}"
if [ "$#" -gt 0 ]; then
  shift
fi

case "${command}" in
up | logs | ps | down) ;;
*)
  usage
  exit 2
  ;;
esac

if [ "${command}" = "down" ] && [ "$#" -gt 0 ] && [ "$*" != "--volumes" ]; then
  usage
  die "option inconnue pour down : $* (seule --volumes est acceptée)"
fi

ENGINE="$(container_engine)" || die "aucun moteur de conteneurs utilisable"
if [ "${ENGINE}" = podman ]; then
  # Bandeau « Executing external compose provider » de `podman compose` coupé.
  export PODMAN_COMPOSE_WARNING_LOGS=false
fi
"${ENGINE}" compose version >/dev/null 2>&1 || die "« ${ENGINE} compose » est introuvable"

ensure_env_file
init_compose

case "${command}" in
up)
  run "${COMPOSE[@]}" up -d --build
  if [ "${DRY_RUN}" = "1" ]; then
    log "(dry-run) attendrait /api/v1/health via Caddy"
  else
    wait_for_health
  fi
  publish_site
  if [ "${DRY_RUN}" != "1" ]; then
    wait_for_front
  fi
  ;;
logs) "${COMPOSE[@]}" logs --follow --tail 100 "$@" ;;
ps) "${COMPOSE[@]}" ps --all ;;
down)
  # --volumes supprime aussi la base et les certificats de Caddy : option explicite uniquement.
  run "${COMPOSE[@]}" down --remove-orphans "$@"
  ;;
esac
