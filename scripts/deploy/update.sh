#!/usr/bin/env bash
# Mise à jour d'un déploiement existant : sauvegarde, git pull de main, rebuild, migrations,
# redémarrage. Refuse un dépôt qui n'est pas sur main (git flow : develop ne se déploie jamais).
# Variables : SKIP_BACKUP=1 saute la sauvegarde préalable (déconseillé : les migrations et les seeds
# modifient la base).
# Codes de sortie : 0 terminé ; 1 erreur (dont l'échec de la sauvegarde : rien n'est alors modifié).
set -euo pipefail

# shellcheck source=scripts/deploy/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_docker
require_deploy_branch
require_env_file
ensure_api_db_password

if [ "${SKIP_BACKUP:-0}" = "1" ]; then
  log "Sauvegarde préalable ignorée (SKIP_BACKUP=1)"
else
  log "Sauvegarde préalable de la base"
  "$(dirname "${BASH_SOURCE[0]}")/backup.sh"
fi

log "Mise à jour du code depuis origin/${DEPLOY_BRANCH} (fast-forward uniquement)"
run git -C "${REPO_DIR}" pull --ff-only origin "${DEPLOY_BRANCH}"

log "Reconstruction de l'image"
run compose build api

log "Migrations, seeds et rôle de lecture seule de l'API"
run compose run --rm migrate

log "Redémarrage de la pile"
run compose up -d

log "État de la pile"
run compose ps
log "Terminé."
