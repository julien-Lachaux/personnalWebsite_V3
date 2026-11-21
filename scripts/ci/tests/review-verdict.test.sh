#!/usr/bin/env bash
# Tests de scripts/ci/review-verdict.sh : OK, BLOQUANT, verdict absent ou ambigu, entrées invalides.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
script=scripts/ci/review-verdict.sh
fail=0
check() { # description, condition (0 = vraie)
  if [ "$2" -eq 0 ]; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi
}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Fichier d'exécution minimal : un message intermédiaire puis le message final `result`.
make() { # nom, texte final
  node -e 'process.stdout.write(JSON.stringify([{ type: "assistant", message: "VERDICT: BLOQUANT" }, { type: "result", result: process.argv[1] }]))' "$2" >"$tmp/$1.json"
}
code() { # nom : code de sortie du script sur ce fichier
  local status=0
  bash "$script" "$tmp/$1.json" >/dev/null 2>&1 || status=$?
  echo "$status"
}

make ok $'Constats : aucun.\n\nVERDICT: OK'
check 'VERDICT: OK : code 0' "$([ "$(code ok)" -eq 0 ] && echo 0 || echo 1)"
make bloquant $'Constat bloquant : fuite.\nVERDICT: BLOQUANT'
check 'VERDICT: BLOQUANT : code 1' "$([ "$(code bloquant)" -eq 1 ] && echo 0 || echo 1)"
make absent $'Revue sans conclusion.'
check 'verdict absent : code 1 (par prudence)' "$([ "$(code absent)" -eq 1 ] && echo 0 || echo 1)"
make milieu $'Je ne dirai pas VERDICT: OK ici, ni en fin de phrase VERDICT: OK.'
check 'verdict noyé dans une phrase : code 1' "$([ "$(code milieu)" -eq 1 ] && echo 0 || echo 1)"
make dernier $'VERDICT: BLOQUANT\nAprès correction :\nVERDICT: OK'
check 'plusieurs verdicts : le dernier l emporte (OK)' "$([ "$(code dernier)" -eq 0 ] && echo 0 || echo 1)"
make dernierb $'VERDICT: OK\nMais finalement :\nVERDICT: BLOQUANT'
check 'plusieurs verdicts : le dernier l emporte (BLOQUANT)' "$([ "$(code dernierb)" -eq 1 ] && echo 0 || echo 1)"
echo '[{"type":"assistant","message":"VERDICT: OK"}]' >"$tmp/sansresult.json"
check 'aucun message result : code 1, un message intermédiaire ne compte pas' "$([ "$(code sansresult)" -eq 1 ] && echo 0 || echo 1)"
echo 'pas du json' >"$tmp/invalide.json"
check 'JSON invalide : code 1' "$([ "$(code invalide)" -eq 1 ] && echo 0 || echo 1)"

status=0
bash "$script" >/dev/null 2>&1 || status=$?
check 'sans paramètre : code 2' "$([ "$status" -eq 2 ] && echo 0 || echo 1)"
status=0
bash "$script" "$tmp/inexistant.json" >/dev/null 2>&1 || status=$?
check 'fichier inexistant : code 2' "$([ "$status" -eq 2 ] && echo 0 || echo 1)"
exit "$fail"
