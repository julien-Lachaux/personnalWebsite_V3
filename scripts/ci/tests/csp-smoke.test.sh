#!/usr/bin/env bash
# Tests de scripts/deploy/csp-smoke.mjs : détection du point d'entrée par fileURLToPath.
# `new URL(import.meta.url).pathname` est un chemin encodé (un espace devient %20, un accent est
# échappé) : dans un dossier dont le nom contient un espace ou un accent, la comparaison avec
# `process.argv[1]` était fausse et le script sortait en 0 sans rien vérifier. Le point d'entrée se
# compare avec `fileURLToPath(import.meta.url)` (node:url), les deux côtés résolus (path.resolve).
# Ramassé par `pnpm integrity:test`. Ni pnpm ni node_modules n'est nécessaire : node suffit.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
script=scripts/deploy/csp-smoke.mjs
fail=0
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
is() { # description, obtenu, attendu
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (obtenu « $2 », attendu « $3 »)"; fail=1; fi
}
has() { # description, texte, fragment attendu
  if grep -qF -- "$3" <<<"$2"; then echo "ok   $1"; else echo "FAIL $1 (« $3 » absent de « $2 »)"; fail=1; fi
}
code() { # code de sortie de la commande
  local s=0
  "$@" >/dev/null 2>&1 || s=$?
  echo "$s"
}

usage='Usage : csp-smoke.mjs' # message d'usage attendu, sans argument

# Chemin qui contient un espace : le script copié là-bas exécute quand même `main`.
spaced="$tmp/dossier avec espace"
mkdir -p "$spaced"
cp "$script" "$spaced/csp-smoke.mjs"
has 'chemin avec espace : message d’usage' "$(node "$spaced/csp-smoke.mjs" 2>&1 || true)" "$usage"
is 'chemin avec espace : code de sortie 2 (usage)' "$(code node "$spaced/csp-smoke.mjs")" 2

# Cas nominal : script du dépôt, sans argument, même message d'usage.
has 'cas nominal : message d’usage' "$(node "$script" 2>&1 || true)" "$usage"
is 'cas nominal : code de sortie 2 (usage)' "$(code node "$script")" 2

# Script importé : `main` n'est pas exécuté, rien sur la sortie, code 0.
imported="$(node -e "import('./$script')" 2>&1 || true)"
is 'importé : aucune exécution de main, aucune sortie' "$imported" ''
is 'importé : code de sortie 0' "$(code node -e "import('./$script')")" 0

exit "$fail"
