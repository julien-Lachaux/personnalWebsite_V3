#!/usr/bin/env bash
# Essai de la variante VPS (docker/compose.vps.yml) sur un poste, sous Podman sans privilèges comme sous
# Docker : pile de production + Caddy de l'HÔTE simulé + deux clients (docker/compose.vps-frontal.yml).
# Sert à prouver l'IP réelle des clients et leur quota séparé (apps/api/test/vps-stack.e2e-spec.ts).
# Aucun port n'est publié : tout passe par `compose exec` dans les clients.
#
# Usage : vps-stack.sh up | ps | logs [service…] | exec <service> <commande…> | stop|start <service…> | errors | down
#
# Variables d'environnement reconnues :
#   VPS_STACK_ENV_FILE      fichier d'environnement (défaut docker/.env.vps-test, créé s'il manque, ignoré par git)
#   CONTAINER_ENGINE        podman ou docker (scripts/container-engine.sh)
#   DRY_RUN=1               affiche les commandes compose qui modifient l'état
#   VPS_STACK_EXTRA_FILE    fichier compose ajouté en dernier (essai : `restart: 'no'` tant que la pile n'a pas démarré)
#   VPS_STACK_WAIT_SECONDS  délai d'attente de la santé (défaut 240)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${VPS_STACK_ENV_FILE:-${REPO_DIR}/docker/.env.vps-test}"
DRY_RUN="${DRY_RUN:-0}"
WAIT_SECONDS="${VPS_STACK_WAIT_SECONDS:-240}"
# shellcheck source=scripts/container-engine.sh
source "${REPO_DIR}/scripts/container-engine.sh"

log() { printf '[vps-stack] %s\n' "$*"; }
die() {
  printf '[vps-stack] ERREUR : %s\n' "$*" >&2
  exit 1
}

command="${1:-}"
if [ "$#" -gt 0 ]; then
  shift
fi
case "${command}" in
up | ps | logs | exec | stop | start | errors | down) ;;
*)
  printf 'Usage : %s up | ps | logs [service…] | exec <service> <commande…> | stop|start <service…> | errors | down\n' "$(basename "$0")" >&2
  exit 2
  ;;
esac

random_secret() { head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

ensure_env_file() {
  if [ -f "${ENV_FILE}" ]; then
    return 0
  fi
  local base="siteperso-v3" run_dir
  if [ -f "${REPO_DIR}/.env" ]; then
    base="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "${REPO_DIR}/.env" | tail -n 1)"
    base="${base:-siteperso-v3}"
  fi
  run_dir="$(mktemp -d "${TMPDIR:-/tmp}/siteperso-vps-run.XXXXXX")"
  # Droits larges : sous Docker (root, sans DAC_OVERRIDE) le socket doit pouvoir être créé dans ce dossier
  # d'essai ; sur le serveur, c'est le dossier 2750 de l'hôte, créé pour le compte de l'appli.
  chmod 0777 "${run_dir}"
  (
    umask 077
    {
      printf 'COMPOSE_PROJECT_NAME=%s-vps\n' "${base}"
      printf 'SITE_DOMAIN=localhost\n'
      printf 'CORS_ORIGIN=https://localhost\n'
      printf 'POSTGRES_PASSWORD=%s\n' "$(random_secret)"
      printf 'API_DB_PASSWORD=%s\n' "$(random_secret)"
      printf '# Quota réduit pour l'"'"'essai du quota par client.\n'
      printf 'RATE_LIMIT_MAX=5\n'
      printf 'RATE_LIMIT_WINDOW_MS=5000\n'
      printf 'WEB_CONTACT_EMAIL=contact@example.org\n'
      printf 'PROD_RUN_DIR=%s\n' "${run_dir}"
    } >"${ENV_FILE}"
  )
  log "créé ${ENV_FILE} (dossier du socket ${run_dir})"
}

if [ "${command}" = "down" ] && [ ! -f "${ENV_FILE}" ]; then
  log "rien à arrêter (${ENV_FILE} absent)"
  exit 0
fi
ensure_env_file
PROJECT="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "${ENV_FILE}" | tail -n 1)"
RUN_DIR="$(sed -n 's/^PROD_RUN_DIR=//p' "${ENV_FILE}" | tail -n 1)"
if [ -z "${PROJECT}" ] || [ -z "${RUN_DIR}" ]; then
  die "COMPOSE_PROJECT_NAME ou PROD_RUN_DIR manque dans ${ENV_FILE}"
fi
# Garde-fou : ce script crée, puis supprime (down : volumes, dossier du socket), une pile d'ESSAI.
# Un VPS_STACK_ENV_FILE pointé par erreur vers un vrai fichier d'environnement ne doit rien toucher
# d'autre : projet compose en `-vps` et dossier du socket créé par ensure_env_file seulement.
case "${PROJECT}" in
*-vps) ;;
*) die "projet « ${PROJECT} » refusé : la pile d'essai porte un nom en -vps (${ENV_FILE} n'est pas un fichier d'essai ?)" ;;
esac
# Dans un `case`, `*` accepte aussi `/` : après le préfixe, ni `/` ni `..` (pas de remontée hors de
# /tmp). Si TMPDIR change entre `up` et `down`, `down` refuse d'agir : échec sûr, rien n'est supprimé.
case "${RUN_DIR}" in
"${TMPDIR:-/tmp}"/siteperso-vps-run.*) ;;
*) die "dossier du socket « ${RUN_DIR} » refusé : attendu ${TMPDIR:-/tmp}/siteperso-vps-run.* (${ENV_FILE} n'est pas un fichier d'essai ?)" ;;
esac
case "${RUN_DIR#"${TMPDIR:-/tmp}"/siteperso-vps-run.}" in
'' | */* | *..*) die "dossier du socket « ${RUN_DIR} » refusé : ni « / » ni « .. » après le préfixe" ;;
esac

# Moteur détecté après le garde-fou : un fichier qui n'est pas d'essai est refusé pour ce motif, même
# sur un poste sans moteur de conteneurs.
ENGINE="$(container_engine)" || die "aucun moteur de conteneurs utilisable"
if [ "${ENGINE}" = podman ]; then
  export PODMAN_COMPOSE_WARNING_LOGS=false
fi

COMPOSE=("${ENGINE}" compose -p "${PROJECT}"
  -f "${REPO_DIR}/docker/compose.prod.yml"
  -f "${REPO_DIR}/docker/compose.vps.yml"
  -f "${REPO_DIR}/docker/compose.vps-frontal.yml"
  --env-file "${ENV_FILE}")
if [ -n "${VPS_STACK_EXTRA_FILE:-}" ]; then
  COMPOSE+=(-f "${VPS_STACK_EXTRA_FILE}")
fi

run() {
  if [ "${DRY_RUN}" = "1" ]; then
    log "(dry-run) $*"
  else
    "$@"
  fi
}

case "${command}" in
up)
  if [ ! -d "${RUN_DIR}" ]; then
    mkdir -p "${RUN_DIR}"
    chmod 0777 "${RUN_DIR}"
  fi
  run "${COMPOSE[@]}" up -d --build caddy frontal client-a client-b
  if [ "${DRY_RUN}" = "1" ]; then
    exit 0
  fi
  deadline=$((SECONDS + WAIT_SECONDS))
  log "attente de /api/v1/health par client-a (frontal, socket Unix, Caddy de la pile, API)"
  until "${COMPOSE[@]}" exec -T client-a wget -q -O /dev/null http://frontal:8080/api/v1/health 2>/dev/null; do
    if [ "${SECONDS}" -ge "${deadline}" ]; then
      "${COMPOSE[@]}" ps --all >&2 || true
      die "la pile ne répond pas après ${WAIT_SECONDS} s (voir : vps-stack.sh logs)"
    fi
    sleep 2
  done
  log "pile prête"
  ;;
ps) "${COMPOSE[@]}" ps --all ;;
exec) "${COMPOSE[@]}" exec -T "$@" ;;
stop | start) "${COMPOSE[@]}" "${command}" "$@" ;;
errors)
  # Copie des pages de secours du site publié vers le frontal d'essai (D48) : mêmes commandes que
  # docs/deploiement.md (« Pages d'erreur quand la pile est arrêtée »), vers le volume `frontal_errors`
  # (/srv/site-perso-errors sur le serveur). À rejouer après chaque publication du site de la pile.
  "${COMPOSE[@]}" exec -T caddy tar -C /srv/web/current/public -cf - 50x.html en/50x.html _nuxt fonts |
    "${COMPOSE[@]}" exec -T frontal tar -C /srv/site-perso-errors -xf -
  "${COMPOSE[@]}" exec -T caddy cat /srv/web/current/csp.caddy |
    sed -n 's/^header Content-Security-Policy "\([^"]*\)"$/\1/p' | tr -d '\n' |
    "${COMPOSE[@]}" exec -T frontal sh -c 'cat > /srv/site-perso-errors/csp.txt'
  "${COMPOSE[@]}" exec -T frontal test -s /srv/site-perso-errors/csp.txt || die "CSP introuvable dans csp.caddy"
  log "pages de secours copiées dans le frontal"
  ;;
logs) "${COMPOSE[@]}" logs --no-color --tail 200 "$@" ;;
down)
  run "${COMPOSE[@]}" down --remove-orphans --volumes
  if [ "${DRY_RUN}" != "1" ]; then
    rm -rf "${RUN_DIR}"
    rm -f "${ENV_FILE}"
  fi
  ;;
esac
