#!/usr/bin/env bash
# Tests de scripts/ci/review-guard.sh : PR du dépôt, fork, brouillon, paramètres invalides.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
script=scripts/ci/review-guard.sh
fail=0
check() { # description, condition (0 = vraie)
  if [ "$2" -eq 0 ]; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi
}
run() { # arguments du script : affiche « code|sortie d'erreur »
  local status=0 err
  err="$(bash "$script" "$@" 2>&1 >/dev/null)" || status=$?
  echo "$status|$err"
}

out="$(run org/depot org/depot false)"
check 'PR du dépôt prête : code 0' "$([ "${out%%|*}" -eq 0 ] && echo 0 || echo 1)"
out="$(run autre/depot org/depot false)"
check 'fork : code 1 et message explicite' "$([ "${out%%|*}" -eq 1 ] && grep -q 'PR issue d.un fork : pas de revue automatique, fusion interdite' <<<"$out" && echo 0 || echo 1)"
out="$(run org/depot org/depot true)"
check 'brouillon : code 1 et message explicite' "$([ "${out%%|*}" -eq 1 ] && grep -q 'PR en brouillon : passer en prête pour la revue' <<<"$out" && echo 0 || echo 1)"
out="$(run autre/depot org/depot true)"
check 'fork en brouillon : code 1, le fork d abord' "$([ "${out%%|*}" -eq 1 ] && grep -q 'fork' <<<"$out" && echo 0 || echo 1)"
out="$(run '' org/depot false)"
check 'dépôt de tête vide : code 2' "$([ "${out%%|*}" -eq 2 ] && echo 0 || echo 1)"
out="$(run org/depot org/depot peut-etre)"
check 'brouillon invalide : code 2' "$([ "${out%%|*}" -eq 2 ] && echo 0 || echo 1)"
out="$(run)"
check 'sans paramètre : code 2' "$([ "${out%%|*}" -eq 2 ] && echo 0 || echo 1)"
exit "$fail"
