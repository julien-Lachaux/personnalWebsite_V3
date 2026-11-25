#!/bin/sh
# Point d'entrée du conteneur Caddy (docker/compose.prod.yml) : valide le mode travaux (docker/wip.caddy),
# prépare l'empreinte du cookie d'accès, puis lance Caddy. Une configuration invalide arrête le conteneur
# avec un message clair : la pile ne démarre pas à moitié protégée.
set -eu

mode="${WIP_MODE:-off}"
case "${mode}" in
off) ;;
on)
  key="${WIP_KEY:-}"
  if [ "${#key}" -lt 32 ]; then
    echo "ERREUR : WIP_MODE=on exige une clé WIP_KEY d'au moins 32 caractères (openssl rand -hex 24)." >&2
    exit 1
  fi
  case "${key}" in
  *[!A-Za-z0-9._~-]*)
    echo "ERREUR : WIP_KEY ne peut contenir que des lettres, chiffres et . _ ~ -" >&2
    exit 1
    ;;
  esac
  # Empreinte, jamais la clé, dans le cookie d'accès ; relue par {file./tmp/wip.token} à chaque
  # chargement de la configuration (démarrage et `caddy reload`, qui voit le même /tmp).
  token="$(printf 'wip:%s' "${key}" | sha256sum | cut -d ' ' -f 1)"
  printf '%s' "${token}" >/tmp/wip.token
  ;;
*)
  echo "ERREUR : WIP_MODE vaut « ${mode} » : attendu on ou off." >&2
  exit 1
  ;;
esac

case "${WIP_API:-open}" in
open | closed) ;;
*)
  echo "ERREUR : WIP_API vaut « ${WIP_API} » : attendu open ou closed." >&2
  exit 1
  ;;
esac

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
