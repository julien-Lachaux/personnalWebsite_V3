#!/bin/sh
# Lanceur des garde-fous (hooks de .claude/settings.json). Fail-closed : si Node ou le script
# manquent, l'action est refusée (code 2) au lieu de passer sans contrôle.
dir=$(dirname "$0")
if ! command -v node >/dev/null 2>&1; then
  echo "Garde-fous : node introuvable, action refusée par prudence." >&2
  exit 2
fi
if [ ! -f "$dir/guard.mjs" ]; then
  echo "Garde-fous : $dir/guard.mjs introuvable, action refusée par prudence." >&2
  exit 2
fi
exec node "$dir/guard.mjs" "$@"
