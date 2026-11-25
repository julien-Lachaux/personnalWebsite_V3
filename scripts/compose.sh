#!/usr/bin/env bash
# « podman compose » ou « docker compose » selon le moteur retenu (scripts/container-engine.sh) :
# utilisé par les scripts db:up, db:test:up, e2e:browsers:up et db:down du package.json racine.
# Avec podman, `podman compose` délègue à un fournisseur (docker-compose ou podman-compose) ; son
# bandeau « Executing external compose provider » est coupé.
set -euo pipefail

# shellcheck source=scripts/container-engine.sh
source "$(dirname "${BASH_SOURCE[0]}")/container-engine.sh"

engine="$(container_engine)"
if [ "${engine}" = podman ]; then
  export PODMAN_COMPOSE_WARNING_LOGS=false
fi
exec "${engine}" compose "$@"
