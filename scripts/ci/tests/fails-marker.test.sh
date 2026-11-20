#!/usr/bin/env bash
# BF-9 (brief back-002, 20 nov. 2026) : FAILS_RE de scripts/ci/check-tests-integrity.sh ne reconnaît
# l'échec attendu de Vitest que sur un appel direct ou enchaîné par une méthode de l'API de test
# (each, for, concurrent…) : la portée d'échec attendu de GRANTABLE suivie d'includes n'est plus un
# marqueur. Les formes déjà détectées le restent. Même harnais que check-tests-integrity.test.sh.
# Lancé par `pnpm integrity:test` et par la CI.
#
# Les marqueurs sont construits à l'exécution : ce fichier n'en contient aucun littéralement.

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/check-tests-integrity.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrite-echec-attendu-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

F=".$(printf '%s' fa)ils"
PW="test.$(printf '%s' fa)il"

passed=0
failed=0
repo=""

new_repo() {
  repo="$WORK/$1"
  mkdir -p "$repo"
  cd "$repo"
  git init -q -b develop
  git config user.name 'Test'
  git config user.email 'ci@noreply.invalid'
  git config commit.gpgsign false
  mkdir -p apps/api/src apps/api/test apps/web/test
  printf 'export const answer = 42;\n' >apps/api/src/app.ts
  git add -A
  git commit -q -m 'base'
  git checkout -q -b lot/essai
}

commit() {
  git add -A
  git commit -q -m "$1"
}

expect() {
  local expected="$1" name="$2" code=0
  bash "$SCRIPT" develop >"$WORK/out.txt" 2>&1 || code=$?
  if [ "$code" -eq "$expected" ]; then
    passed=$((passed + 1))
    printf 'ok      %s\n' "$name"
  else
    failed=$((failed + 1))
    printf 'ÉCHEC   %s (code %s, attendu %s)\n' "$name" "$code" "$expected"
    sed 's/^/        /' "$WORK/out.txt"
  fi
}

# Faux positifs : appels ordinaires après la portée d'échec attendu.
new_repo portee-includes
printf '%s\n' "export const ok = GRANTABLE${F}.includes('qa');" >apps/api/src/roles.ts
commit 'feat: lit la portée'
expect 0 'appel includes sur la portée d’échec attendu (commit)'

new_repo portee-non-suivie
printf '%s\n' "const roles = scopes${F}.map((r) => r.trim());" "const n = report${F}.filter(Boolean);" >apps/api/src/scopes.ts
expect 0 'appels map et filter sur la portée d’échec attendu (fichier non suivi)'

# Détections conservées : chaque forme, sans justification, échoue.
check_marker() {
  local slug="$1" line="$2" name="$3"
  new_repo "$slug"
  printf '%s\n' "$line" >apps/api/test/bug.e2e-spec.ts
  commit 'test: défaut connu'
  expect 1 "$name"
}

check_marker direct "it${F}('BUG-9', () => {});" 'appel direct'
check_marker concurrent-avant "it.concurrent${F}('BUG-9', async () => {});" 'concurrent puis échec attendu'
check_marker each "it${F}.each([1, 2])('BUG-9 %i', () => {});" 'enchaîné par each'
check_marker each-gabarit "it${F}.each\`a | b\`('BUG-9', () => {});" 'enchaîné par each sur un gabarit'
check_marker for "it${F}.for([1])('BUG-9 %i', () => {});" 'enchaîné par for'
check_marker concurrent-apres "it${F}.concurrent('BUG-9', async () => {});" 'enchaîné par concurrent'
check_marker extend "it${F}.extend({ db: 1 })('BUG-9', () => {});" 'enchaîné par extend'
check_marker chaine-longue "it${F}.concurrent.each([1])('BUG-9 %i', () => {});" 'enchaîné par plusieurs méthodes'
check_marker test-etendu "myTest${F}('BUG-9', ({ db }) => {});" 'API de test étendue'
check_marker playwright "${PW}('BUG-F1', async () => {});" 'échec attendu de Playwright'

new_repo justifie
printf '%s\n' "it${F}.each([1])('BUG-9 %i', () => {});" >apps/api/test/bug.e2e-spec.ts
commit "$(printf 'test: défaut connu\n\nJustification-test: BUG-9 défaut établi, correction au lot suivant')"
expect 0 'échec attendu enchaîné, justifié'

printf '\n%s réussi(s), %s échec(s)\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
