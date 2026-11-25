#!/usr/bin/env bash
# Tests de scripts/ci/static-analysis.sh : paramètre refusé, mode simulation, images épinglées par digest.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
script=scripts/ci/static-analysis.sh
fail=0
check() { # description, condition (0 = vraie)
  if [ "$2" -eq 0 ]; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi
}

status=0
bash "$script" >/dev/null 2>&1 || status=$?
check 'sans paramètre : code 2' "$([ "$status" -eq 2 ] && echo 0 || echo 1)"
status=0
bash "$script" inconnu >/dev/null 2>&1 || status=$?
check 'paramètre inconnu : code 2' "$([ "$status" -eq 2 ] && echo 0 || echo 1)"

out="$(SIMULATION=1 bash "$script" workflows)"
check 'workflows : actionlint par digest' "$(grep -qE '(docker|podman) run .*rhysd/actionlint@sha256:[0-9a-f]{64}' <<<"$out" && echo 0 || echo 1)"
out="$(SIMULATION=1 bash "$script" shell)"
check 'shell : shellcheck par digest, trois lancements' "$([ "$(grep -cE 'koalaman/shellcheck@sha256:[0-9a-f]{64}' <<<"$out")" -eq 3 ] && echo 0 || echo 1)"
check 'shell : SC1112 écarté pour les seuls tests de scripts/ci/tests' "$([ "$(grep -c -- '-e SC1112' <<<"$out")" -eq 1 ] && grep -- '-e SC1112' <<<"$out" | grep -q 'scripts/ci/tests/static-analysis.test.sh' && ! grep -- '-e SC1112' <<<"$out" | grep -q 'scripts/deploy' && echo 0 || echo 1)"
check 'shell : run.sh et un script de scripts/ analysés' "$(grep -q 'scripts/ci/check-tests-integrity.sh' <<<"$out" && grep -q '.claude/hooks/run.sh' <<<"$out" && echo 0 || echo 1)"
check 'shell : pre-commit en dialecte sh' "$(grep -q -- '--shell=sh .husky/pre-commit' <<<"$out" && echo 0 || echo 1)"
exit "$fail"
