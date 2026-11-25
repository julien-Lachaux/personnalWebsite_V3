#!/usr/bin/env bash
# Tests de scripts/ci/check-front-matrix.mjs (L26-03) : fichiers réels cohérents, divergences refusées.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
script=scripts/ci/check-front-matrix.mjs
fail=0
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
is() { # description, obtenu, attendu
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (obtenu « $2 », attendu « $3 »)"; fail=1; fi
}
code() { # code de sortie de la commande
  local s=0
  "$@" >/dev/null 2>&1 || s=$?
  echo "$s"
}

cat >"$tmp/config.ts" <<'TS'
export const viewports = [
  { name: 'petit-390', width: 390, height: 844 },
  { name: 'grand-1440', width: 1440, height: 900 },
] as const;
TS
workflow() { # écran... : workflow minimal dont la matrice liste ces écrans
  {
    printf 'jobs:\n  autre:\n    steps: []\n  front-parcours:\n    strategy:\n      matrix:\n        project:\n'
    for p in "$@"; do printf '          - %s\n' "$p"; done
    printf '    steps: []\n  fin:\n    steps: []\n'
  } >"$tmp/ci.yml"
}

is 'fichiers réels du dépôt : cohérents' "$(code node "$script")" 0
workflow petit-390 grand-1440
is 'listes identiques : code 0' "$(code node "$script" "$tmp/config.ts" "$tmp/ci.yml")" 0
workflow petit-390
is 'écran manquant dans la matrice : code 1' "$(code node "$script" "$tmp/config.ts" "$tmp/ci.yml")" 1
workflow petit-390 grand-1440 ultra-3440
is 'écran en trop dans la matrice : code 1' "$(code node "$script" "$tmp/config.ts" "$tmp/ci.yml")" 1
workflow petit-390 grand-1440-x
is 'écran renommé : code 1' "$(code node "$script" "$tmp/config.ts" "$tmp/ci.yml")" 1
workflow grand-1440 petit-390
is 'ordre différent : code 1' "$(code node "$script" "$tmp/config.ts" "$tmp/ci.yml")" 1
workflow petit-390 grand-1440
is 'message de succès' "$(node "$script" "$tmp/config.ts" "$tmp/ci.yml")" 'Matrice front-parcours cohérente (2 écrans).'
printf 'jobs:\n  autre:\n    steps: []\n' >"$tmp/sans-job.yml"
is 'job front-parcours absent : code 1' "$(code node "$script" "$tmp/config.ts" "$tmp/sans-job.yml")" 1
echo 'export const autre = 1;' >"$tmp/sans-vp.ts"
is 'tableau viewports absent : code 1' "$(code node "$script" "$tmp/sans-vp.ts" "$tmp/ci.yml")" 1

exit "$fail"
