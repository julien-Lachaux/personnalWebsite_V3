#!/usr/bin/env bash
# Sauvegarde de la base : pg_dump compressé dans DEPLOY_DIR/backups, rotation des plus anciennes.
# Variables : BACKUP_KEEP (nombre de sauvegardes conservées, défaut 14).
# Codes de sortie : 0 terminé ; 1 erreur.
set -euo pipefail

# shellcheck source=scripts/deploy/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

BACKUP_KEEP="${BACKUP_KEEP:-14}"
BACKUP_DIR="${DEPLOY_DIR}/backups"

require_docker
require_env_file

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
target="${BACKUP_DIR}/siteperso-$(date +%Y%m%d-%H%M%S).sql.gz"

log "Sauvegarde vers ${target}"
if [ "${DRY_RUN}" = "1" ]; then
  log "(dry-run) compose exec -T postgres pg_dump | gzip > ${target}"
  exit 0
fi

# Écriture dans un fichier temporaire pour ne jamais laisser une sauvegarde tronquée sous le bon nom.
compose exec -T postgres pg_dump --no-owner --clean --if-exists -U siteperso siteperso |
  gzip >"${target}.part"
mv "${target}.part" "${target}"
chmod 600 "${target}"

log "Rotation : conservation des ${BACKUP_KEEP} plus récentes"
# shellcheck disable=SC2012 # noms générés par ce script, sans caractère spécial
ls -1t "${BACKUP_DIR}"/siteperso-*.sql.gz | tail -n "+$((BACKUP_KEEP + 1))" | while read -r old; do
  rm -f -- "${old}"
done
log "Terminé."
