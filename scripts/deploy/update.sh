#!/usr/bin/env bash
# Mise à jour d'un déploiement existant : git pull, rebuild, migrations, redémarrage.
# Codes de sortie : 0 terminé ; 1 erreur.
set -euo pipefail

# shellcheck source=scripts/deploy/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_docker
require_env_file
ensure_api_db_password

log "Mise à jour du code (fast-forward uniquement)"
run git -C "${REPO_DIR}" pull --ff-only

log "Reconstruction de l'image"
run compose build api

log "Migrations, seeds et rôle de lecture seule de l'API"
run compose run --rm migrate

log "Redémarrage de la pile"
run compose up -d

log "État de la pile"
run compose ps
log "Terminé."
