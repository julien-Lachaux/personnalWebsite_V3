#!/usr/bin/env bash
# Publication du front statique (BF-13), à sourcer après avoir défini `compose`, `run`, `log` (common.sh
# du déploiement, local-stack.sh de la pile locale). À appeler quand l'API est migrée, seedée et saine.
#
# Le service `web-build` (profil `build`, jamais lancé par `compose up`) lance `nuxt generate` contre
# l'API, relève les empreintes CSP puis bascule atomiquement le volume du site sur la nouvelle version
# (scripts/deploy/web-generate.sh). S'il échoue, `set -e` arrête l'appelant : le lien `current` n'a pas
# bougé, Caddy continue de servir la version précédente. Caddy relit ensuite sa configuration, car la
# CSP (empreintes) est importée depuis la version publiée.

publish_site() {
  log "Image de génération du front"
  run compose build web-build
  log "Génération du front contre l'API migrée et seedée (un échec laisse le site précédent en place)"
  run compose run --rm web-build
  log "Rechargement de Caddy (CSP de la nouvelle version)"
  run compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --force
}
