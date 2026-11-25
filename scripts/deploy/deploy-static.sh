#!/usr/bin/env bash
# Déploiement de la production tout statique (lot 33) : ni API, ni base, ni génération sur le serveur. Le
# site d'une release est une archive `site-<version>.tar.gz` (dossiers `public/` et fichier `csp.caddy`)
# produite par la CI et jointe à la release GitHub, avec sa somme SHA-256.
#
# Usage :
#   deploy-static.sh <X.Y.Z>             télécharge, vérifie, extrait et active la version
#   deploy-static.sh --rollback [X.Y.Z]  réactive une version déjà présente (défaut : la plus récente
#                                        avant la version active)
#
# Étapes : somme vérifiée AVANT toute extraction (somme fausse : rien n'est modifié) ; extraction dans un
# dossier de travail puis déplacement vers DEPLOY_DIR/site/releases/<version>/ ; bascule atomique du lien
# `current` (lien temporaire puis `mv -T`) ; trois versions gardées ; `compose up -d` puis rechargement de
# Caddy (CSP) ; copie des pages de secours pour le Caddy de l'hôte (STATIC_ERRORS_DIR).
#
# Variables d'environnement :
#   DEPLOY_DIR                dossier de l'appli (défaut /opt/siteperso-v3 ; VPS : /srv/apps/site-perso) ; le
#                             site est dans DEPLOY_DIR/site, l'environnement facultatif dans DEPLOY_DIR/.env.prod
#   STATIC_RELEASE_BASE_URL   dossier HTTPS des fichiers de la release (file:// admis pour un essai) ; défaut
#                             https://github.com/<STATIC_RELEASE_REPO>/releases/download/v<version>
#   STATIC_RELEASE_REPO       <propriétaire>/<dépôt> GitHub (dépôt public) ; obligatoire sans STATIC_RELEASE_BASE_URL
#   STATIC_ERRORS_DIR         pages de secours de l'hôte (défaut /srv/site-perso-errors) ; absent : copie ignorée
#   DEPLOY_COMPOSE            commande compose (défaut « docker compose » ; VPS : « docker-compose »)
#   DRY_RUN=1                 valide et affiche le plan, ne modifie rien
# Codes de sortie : 0 terminé ; 1 erreur (la version active reste en place) ; 2 usage.
set -euo pipefail

# shellcheck source=scripts/deploy/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

KEEP_RELEASES=3
STATIC_COMPOSE_FILE="${REPO_DIR}/docker/compose.vps-static.yml"
SITE_DIR="${DEPLOY_DIR}/site"
ERRORS_DIR="${STATIC_ERRORS_DIR:-/srv/site-perso-errors}"
VERSION_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+$'

usage() {
  printf 'Usage : %s <X.Y.Z> | --rollback [X.Y.Z]\n' "$(basename "$0")" >&2
  exit 2
}

mode=deploy
version=''
case "${1:-}" in
'') usage ;;
--rollback)
  mode=rollback
  [ "$#" -le 2 ] || usage
  version="${2:-}"
  ;;
-*) usage ;;
*)
  [ "$#" -eq 1 ] || usage
  version="$1"
  ;;
esac
if [ -n "${version}" ] && ! [[ "${version}" =~ ${VERSION_PATTERN} ]]; then
  die "version invalide : « ${version} » (attendu X.Y.Z)"
fi

# Commande compose de la pile statique ; l'environnement facultatif n'est lu que s'il existe.
static_compose() {
  local cmd files=(-f "${STATIC_COMPOSE_FILE}")
  read -r -a cmd <<<"${DEPLOY_COMPOSE}"
  if [ -f "${ENV_FILE}" ]; then
    files+=(--env-file "${ENV_FILE}")
  fi
  STATIC_SITE_DIR="${SITE_DIR}" "${cmd[@]}" "${files[@]}" "$@"
}

# Version vers laquelle `current` pointe (vide si aucune).
active_version() {
  local target
  target="$(readlink "${SITE_DIR}/current" 2>/dev/null || true)"
  printf '%s' "${target#releases/}"
}

# Versions présentes, de la plus récente à la plus ancienne (tri sémantique).
installed_versions() {
  [ -d "${SITE_DIR}/releases" ] || return 0
  find "${SITE_DIR}/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
    | grep -E "${VERSION_PATTERN}" | sort -rV || true
}

# Refuse une archive qui sort de son dossier ou contient autre chose que public/ et csp.caddy.
check_archive_paths() {
  local archive="$1" entry
  while IFS= read -r entry; do
    case "${entry}" in
    public | public/* | csp.caddy) ;;
    *) die "entrée inattendue dans l'archive : « ${entry} »" ;;
    esac
    case "/${entry}/" in
    */../*) die "entrée dangereuse dans l'archive : « ${entry} »" ;;
    esac
  done < <(tar -tzf "${archive}")
}

download_and_extract() {
  local base archive work
  base="${STATIC_RELEASE_BASE_URL:-}"
  if [ -z "${base}" ]; then
    [ -n "${STATIC_RELEASE_REPO:-}" ] || die "STATIC_RELEASE_REPO (<propriétaire>/<dépôt>) ou STATIC_RELEASE_BASE_URL est requis"
    [[ "${STATIC_RELEASE_REPO}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "STATIC_RELEASE_REPO invalide : « ${STATIC_RELEASE_REPO} »"
    base="https://github.com/${STATIC_RELEASE_REPO}/releases/download/v${version}"
  fi
  case "${base}" in
  https://* | file://*) ;;
  *) die "STATIC_RELEASE_BASE_URL doit commencer par https:// (ou file:// pour un essai)" ;;
  esac
  archive="site-${version}.tar.gz"
  work="$(mktemp -d "${SITE_DIR}/.work.XXXXXX")"
  trap 'rm -rf "${work}"' EXIT

  log "Téléchargement de ${archive} et de sa somme"
  curl --fail --silent --show-error --location --proto '=https,file' --proto-redir '=https' \
    --max-time 300 --output "${work}/${archive}" "${base}/${archive}" || die "archive introuvable : ${base}/${archive}"
  curl --fail --silent --show-error --location --proto '=https,file' --proto-redir '=https' \
    --max-time 60 --output "${work}/${archive}.sha256" "${base}/${archive}.sha256" || die "somme introuvable : ${base}/${archive}.sha256"

  # Le fichier de somme ne désigne que l'archive attendue (pas un autre fichier, pas un autre dossier).
  if [ "$(awk 'END { print NR }' "${work}/${archive}.sha256")" != "1" ] \
    || [ "$(awk '{ print $2 }' "${work}/${archive}.sha256")" != "${archive}" ]; then
    die "fichier de somme inattendu (une ligne « <somme>  ${archive} » attendue)"
  fi
  (cd "${work}" && sha256sum --check --status "${archive}.sha256") \
    || die "somme SHA-256 de ${archive} fausse : archive refusée, rien n'a été modifié"
  log "Somme SHA-256 vérifiée"

  check_archive_paths "${work}/${archive}"
  mkdir "${work}/extract"
  tar -xzf "${work}/${archive}" -C "${work}/extract" --no-same-owner --no-same-permissions
  for required in public/index.html public/en/index.html public/404.html public/50x.html public/en/50x.html csp.caddy; do
    [ -s "${work}/extract/${required}" ] || die "archive incomplète : ${required} absent"
  done
  if [ -L "${work}/extract/public" ] || [ -L "${work}/extract/csp.caddy" ]; then
    die "archive refusée : lien symbolique à la racine"
  fi

  rm -rf "${SITE_DIR}/releases/${version}"
  mv "${work}/extract" "${SITE_DIR}/releases/${version}"
  chmod -R a+rX "${SITE_DIR}/releases/${version}"
  rm -rf "${work}"
  trap - EXIT
}

# Bascule atomique de `current` (un seul renommage).
switch_current() {
  rm -f "${SITE_DIR}/.current-next"
  ln -s "releases/${version}" "${SITE_DIR}/.current-next"
  mv -T "${SITE_DIR}/.current-next" "${SITE_DIR}/current"
  log "actif : releases/${version}"
}

# Garde les KEEP_RELEASES plus récentes et, toujours, la version active.
prune_releases() {
  local active old
  active="$(active_version)"
  installed_versions | tail -n "+$((KEEP_RELEASES + 1))" | while read -r old; do
    [ "${old}" = "${active}" ] && continue
    rm -rf "${SITE_DIR}/releases/${old}"
    log "supprimé : releases/${old}"
  done
}

# Pages 50x et CSP (valeur seule) pour le Caddy de l'hôte, depuis la version active, sans conteneur.
copy_error_pages() {
  local current="${SITE_DIR}/current" csp
  if [ ! -d "${ERRORS_DIR}" ] || [ ! -w "${ERRORS_DIR}" ]; then
    log "AVERTISSEMENT : ${ERRORS_DIR} absent ou non inscriptible : pages de secours de l'hôte non copiées (docs/deploiement.md)"
    return 0
  fi
  csp="$(sed -n 's/^[[:space:]]*header Content-Security-Policy "\([^"]*\)"$/\1/p' "${current}/csp.caddy" | tr -d '\n')"
  [ -n "${csp}" ] || die "CSP introuvable dans csp.caddy : pages de secours non copiées"
  rm -rf "${ERRORS_DIR}/_nuxt" "${ERRORS_DIR}/fonts" "${ERRORS_DIR}/en"
  mkdir -p "${ERRORS_DIR}/en"
  cp "${current}/public/50x.html" "${ERRORS_DIR}/50x.html"
  cp "${current}/public/en/50x.html" "${ERRORS_DIR}/en/50x.html"
  cp -R "${current}/public/_nuxt" "${ERRORS_DIR}/_nuxt"
  cp -R "${current}/public/fonts" "${ERRORS_DIR}/fonts"
  printf '%s' "${csp}" >"${ERRORS_DIR}/csp.txt"
  chmod -R a+rX "${ERRORS_DIR}"
  log "pages de secours copiées dans ${ERRORS_DIR}"
}

reload_caddy() {
  log "Démarrage de Caddy si besoin, puis rechargement (CSP de la version active)"
  static_compose up -d
  static_compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --force
}

# --- exécution ------------------------------------------------------------------------------------
require_deploy_branch
read -r -a compose_words <<<"${DEPLOY_COMPOSE}"
[ "${#compose_words[@]}" -gt 0 ] || die "DEPLOY_COMPOSE est vide"
command -v "${compose_words[0]}" >/dev/null 2>&1 || die "${compose_words[0]} est introuvable (DEPLOY_COMPOSE)"

if [ "${DRY_RUN}" = "1" ]; then
  log "(dry-run) ${mode} ${version:-<précédente>} dans ${SITE_DIR} : téléchargement, somme, extraction, bascule, rechargement, pages de secours (${ERRORS_DIR})"
  exit 0
fi

mkdir -p "${SITE_DIR}/releases"
if [ "${mode}" = "deploy" ]; then
  if [ -d "${SITE_DIR}/releases/${version}" ] && [ "$(active_version)" = "${version}" ]; then
    log "La version ${version} est déjà active : rien à télécharger"
  else
    download_and_extract
  fi
else
  if [ -z "${version}" ]; then
    active="$(active_version)"
    # Plus récente des versions strictement plus anciennes que l'active (sans version active : la plus récente).
    version="$(installed_versions | awk -v active="${active}" 'active == "" || found { print; exit } $0 == active { found = 1 }')"
    [ -n "${version}" ] || die "aucune version précédente à réactiver"
  fi
  [ -s "${SITE_DIR}/releases/${version}/csp.caddy" ] || die "la version ${version} n'est pas installée (releases/${version})"
  log "Retour arrière vers ${version}"
fi

switch_current
prune_releases
reload_caddy
copy_error_pages
log "Terminé."
