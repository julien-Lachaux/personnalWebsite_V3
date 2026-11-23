#!/usr/bin/env bash
# Tests de scripts/ci/review-usage.mjs (L26-06) : un run, plusieurs runs, entrée standard, entrées invalides.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
script=scripts/ci/review-usage.mjs
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

cat >"$tmp/exec.json" <<'JSON'
[
  { "type": "system", "subtype": "init", "model": "claude-opus-5-5" },
  { "type": "assistant", "message": "texte" },
  { "type": "result", "result": "VERDICT: OK", "total_cost_usd": 1.36, "num_turns": 20, "duration_ms": 143000 }
]
JSON
out="$(node "$script" --pr 7 --run 123 "$tmp/exec.json")"
is 'fichier d exécution : en-tête du tableau' "$(sed -n 1p <<<"$out")" '| Run | PR | Modèle | Coût (USD équivalent) | Tours | Durée (s) |'
is 'fichier d exécution : ligne du run' "$(sed -n 3p <<<"$out")" '| 123 | 7 | claude-opus-5-5 | 1.36 | 20 | 143 |'
is 'un seul run : pas de ligne de total' "$(wc -l <<<"$out" | tr -d ' ')" 3

cat >"$tmp/liste.json" <<'JSON'
[
  { "run": 1, "pr": 7, "model": "m", "total_cost_usd": 1.5, "num_turns": 10, "duration_ms": 60000 },
  { "run": 2, "pr": 9, "total_cost_usd": 0.25, "num_turns": 5, "duration_ms": 30000 }
]
JSON
out="$(node "$script" <"$tmp/liste.json")"
is 'liste de runs : modèle inconnu signalé' "$(sed -n 4p <<<"$out")" '| 2 | 9 | inconnu | 0.25 | 5 | 30 |'
is 'liste de runs : total' "$(sed -n 5p <<<"$out")" '| **Total (2 runs)** | | | 1.75 | 15 | 90 |'

echo '{"type":"result","total_cost_usd":2,"num_turns":3,"duration_ms":1500}' >"$tmp/result.json"
is 'message result seul, entrée standard explicite' "$(node "$script" - <"$tmp/result.json" | sed -n 3p)" '| - | - | inconnu | 2.00 | 3 | 2 |'
echo '[[{"type":"result","total_cost_usd":1,"num_turns":1,"duration_ms":1000}],[{"type":"result","total_cost_usd":2,"num_turns":2,"duration_ms":2000}]]' >"$tmp/deux.json"
is 'liste de fichiers d exécution : total' "$(node "$script" "$tmp/deux.json" | sed -n 5p)" '| **Total (2 runs)** | | | 3.00 | 3 | 3 |'

echo 'pas du json' >"$tmp/invalide.json"
is 'JSON invalide : code 1' "$(code node "$script" "$tmp/invalide.json")" 1
is 'fichier absent : code 1' "$(code node "$script" "$tmp/absent.json")" 1
echo '[{"type":"result","result":"x"}]' >"$tmp/sans-valeurs.json"
is 'valeurs absentes : code 1' "$(code node "$script" "$tmp/sans-valeurs.json")" 1
echo '[]' >"$tmp/vide.json"
is 'liste vide : code 1' "$(code node "$script" "$tmp/vide.json")" 1
is 'option inconnue : code 2' "$(code node "$script" --x "$tmp/exec.json")" 2
is '--pr sans entier : code 2' "$(code node "$script" --pr abc "$tmp/exec.json")" 2
is '--pr sans valeur : code 2' "$(code node "$script" --pr)" 2

exit "$fail"
