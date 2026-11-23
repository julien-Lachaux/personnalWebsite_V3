#!/bin/sh
# Génération et publication du front statique (BF-13), exécuté DANS l'image docker/web.Dockerfile.
#
# 1. `nuxt generate` contre l'API de la pile (NUXT_API_BASE_URL) : un échec arrête tout ici, le site
#    publié n'a pas été touché ;
# 2. contrôles de cohérence des pages (accueil fr, en, page 404) ;
# 3. relevé des empreintes CSP des scripts et styles en ligne (csp-hashes.mjs) ;
# 4. nouvelle version dans ${SITE_DIR}/releases/<id>/{public,csp.caddy}, puis bascule atomique du lien
#    ${SITE_DIR}/current (création d'un lien temporaire puis `mv -T`, un seul renommage) ;
# 5. les trois dernières versions sont gardées (retour arrière : pointer `current` sur la précédente).
# Caddy relit sa configuration (CSP) après la bascule : scripts/deploy/site.sh (publish_site).
# Variables : SITE_DIR (défaut /site), CSP_SCRIPT (défaut /opt/deploy/csp-hashes.mjs).
# Codes de sortie : 0 publié ; 1 erreur (le site précédent reste en place).
set -eu

SITE_DIR="${SITE_DIR:-/site}"
CSP_SCRIPT="${CSP_SCRIPT:-/opt/deploy/csp-hashes.mjs}"
KEEP_RELEASES=3

log() { printf '[web] %s\n' "$*"; }
die() {
  printf '[web] ERREUR : %s\n' "$*" >&2
  exit 1
}

if [ ! -d "${SITE_DIR}" ] || [ ! -w "${SITE_DIR}" ]; then
  die "${SITE_DIR} absent ou non inscriptible (volume du site)"
fi
[ -n "${NUXT_PUBLIC_CONTACT_EMAIL:-}" ] || die "NUXT_PUBLIC_CONTACT_EMAIL est vide (WEB_CONTACT_EMAIL du fichier d'environnement)"

release_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
staging="${SITE_DIR}/.staging-${release_id}"
trap 'rm -rf "${staging}" "${SITE_DIR}/.current-next"' EXIT

log "génération (source du contenu : ${NUXT_CV_SOURCE:-api}, API : ${NUXT_API_BASE_URL:-non définie})"
./node_modules/.bin/nuxt generate || die "nuxt generate a échoué : le site publié est inchangé"

public=.output/public
for page in index.html en/index.html 404.html; do
  [ -s "${public}/${page}" ] || die "page attendue absente après la génération : ${page}"
done

mkdir -p "${staging}"
cp -R "${public}" "${staging}/public"
node "${CSP_SCRIPT}" "${staging}/public" "${staging}/csp.caddy" || die "relevé des empreintes CSP impossible"

mkdir -p "${SITE_DIR}/releases"
mv "${staging}" "${SITE_DIR}/releases/${release_id}"
rm -f "${SITE_DIR}/.current-next"
ln -s "releases/${release_id}" "${SITE_DIR}/.current-next"
mv -T "${SITE_DIR}/.current-next" "${SITE_DIR}/current"
log "publié : releases/${release_id}"

# Élagage : les plus anciennes versions (identifiants datés, donc triés par date ; `tail -n +N` : de la
# ligne N à la fin, compatible busybox).
# shellcheck disable=SC2012
ls -1 "${SITE_DIR}/releases" | sort -r | tail -n "+$((KEEP_RELEASES + 1))" | while read -r old; do
  rm -rf "${SITE_DIR}/releases/${old}"
done
log "terminé"
