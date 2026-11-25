#!/usr/bin/env bash
# Archive du site statique d'une release (lot 33, production sans API ni base) : génère le front contre
# l'API (déjà migrée, seedée et joignable), contrôle les pages, relève la CSP, puis écrit
# `site-<version>.tar.gz` (dossiers `public/` et fichier `csp.caddy`, même disposition qu'un dossier
# `releases/<id>/` de web-generate.sh) et sa somme `site-<version>.tar.gz.sha256`.
# Exécuté par le job « Site statique » de .github/workflows/release.yml, jamais sur le serveur.
#
# Usage : build-site-archive.sh <version X.Y.Z> <dossier de sortie>
#
# Variables d'environnement :
#   NUXT_PUBLIC_CONTACT_EMAIL  adresse du bouton de contact, figée dans les pages (obligatoire)
#   NUXT_PUBLIC_I18N_BASE_URL  URL publique du site, https, sans barre finale (obligatoire)
#   NUXT_API_BASE_URL          API qui sert le contenu pendant la génération (défaut http://127.0.0.1:3000)
#   NUXT_CV_SOURCE             api (défaut) ou fixtures
#   SITE_PUBLIC_DIR            dossier généré (défaut apps/web/.output/public)
#   SITE_SKIP_GENERATE=1       ne génère pas : archive le dossier SITE_PUBLIC_DIR existant (tests)
# Codes de sortie : 0 archive écrite ; 1 erreur ; 2 usage.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

log() { printf '[archive] %s\n' "$*"; }
die() {
  printf '[archive] ERREUR : %s\n' "$*" >&2
  exit 1
}

if [ "$#" -ne 2 ]; then
  printf 'Usage : %s <version X.Y.Z> <dossier de sortie>\n' "$(basename "$0")" >&2
  exit 2
fi
version="$1"
output_dir="$2"

[[ "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version invalide : « ${version} » (attendu X.Y.Z)"
[ -n "${NUXT_PUBLIC_CONTACT_EMAIL:-}" ] || die "NUXT_PUBLIC_CONTACT_EMAIL est vide (variable de dépôt GitHub SITE_CONTACT_EMAIL)"
[ -n "${NUXT_PUBLIC_I18N_BASE_URL:-}" ] || die "NUXT_PUBLIC_I18N_BASE_URL est vide (variable de dépôt GitHub SITE_BASE_URL)"
[[ "${NUXT_PUBLIC_I18N_BASE_URL}" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]] \
  || die "NUXT_PUBLIC_I18N_BASE_URL doit être une origine https sans chemin ni barre finale"
case "${NUXT_CV_SOURCE:-api}" in
api | fixtures) ;;
*) die "NUXT_CV_SOURCE invalide : « ${NUXT_CV_SOURCE} » (api ou fixtures)" ;;
esac
export NUXT_CV_SOURCE="${NUXT_CV_SOURCE:-api}"
export NUXT_API_BASE_URL="${NUXT_API_BASE_URL:-http://127.0.0.1:3000}"

public="${SITE_PUBLIC_DIR:-${REPO_DIR}/apps/web/.output/public}"

if [ "${SITE_SKIP_GENERATE:-0}" = "1" ]; then
  log "génération ignorée (SITE_SKIP_GENERATE=1) : ${public}"
else
  log "génération (source du contenu : ${NUXT_CV_SOURCE}, API : ${NUXT_API_BASE_URL})"
  pnpm --dir "${REPO_DIR}" --filter @siteperso/web generate || die "nuxt generate a échoué"
fi

# Mêmes contrôles que web-generate.sh : accueil fr, en, 404, et les pages d'erreur servies par Caddy.
for page in index.html en/index.html 404.html 50x.html en/50x.html; do
  [ -s "${public}/${page}" ] || die "page attendue absente après la génération : ${page}"
done

mkdir -p "${output_dir}"
output_dir="$(cd "${output_dir}" && pwd)"
staging="$(mktemp -d "${output_dir}/.staging.XXXXXX")"
trap 'rm -rf "${staging}"' EXIT

cp -R "${public}" "${staging}/public"
node "${REPO_DIR}/scripts/deploy/csp-hashes.mjs" "${staging}/public" "${staging}/csp.caddy" \
  || die "relevé des empreintes CSP impossible"

archive="site-${version}.tar.gz"
# Ordre et métadonnées fixés : deux générations du même contenu donnent la même archive.
tar --sort=name --owner=0 --group=0 --numeric-owner --mtime='UTC 2000-01-01' \
  -C "${staging}" -cf - public csp.caddy | gzip -n >"${output_dir}/${archive}"
(cd "${output_dir}" && sha256sum "${archive}" >"${archive}.sha256")
log "écrit ${output_dir}/${archive} et ${archive}.sha256"
