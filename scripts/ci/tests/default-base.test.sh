#!/usr/bin/env bash
# Base par défaut de scripts/ci/check-tests-integrity.sh (git flow, décision de Julien du
# 19 nov. 2026) : sans argument, le script compare à origin/develop, sinon à develop ; l'ancienne
# branche d'intégration n'est plus une base par défaut. Chaque cas crée un dépôt git temporaire.
# Lancé par `pnpm integrity:test` (donc par pnpm check) et par la CI.

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/check-tests-integrity.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrite-base-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

passed=0
failed=0

# Dépôt dont la branche d'intégration s'appelle $2, avec une branche de lot qui supprime un test
# sans justification (écart que seule une comparaison à la bonne base révèle).
new_repo() {
  local repo="$WORK/$1"
  mkdir -p "$repo/apps/api/test"
  cd "$repo"
  git init -q -b "$2"
  git config user.name 'Test'
  git config user.email 'ci@noreply.invalid'
  git config commit.gpgsign false
  printf "it('e2e', () => {});\n" >apps/api/test/a.e2e-spec.ts
  git add -A
  git commit -q -m 'base'
  git checkout -q -b lot/essai
  git rm -q apps/api/test/a.e2e-spec.ts
  git commit -q -m 'test: retire un test'
}

# expect <code attendu> <motif attendu dans la sortie> <nom du cas>
expect() {
  local expected="$1" pattern="$2" name="$3" code=0
  bash "$SCRIPT" >"$WORK/out.txt" 2>&1 || code=$?
  if [ "$code" -eq "$expected" ] && grep -q -- "$pattern" "$WORK/out.txt"; then
    passed=$((passed + 1))
    printf 'ok      %s\n' "$name"
  else
    failed=$((failed + 1))
    printf 'ÉCHEC   %s (code %s, attendu %s, motif « %s »)\n' "$name" "$code" "$expected" "$pattern"
    sed 's/^/        /' "$WORK/out.txt"
  fi
}

new_repo develop-local develop
expect 1 'HEAD comparé à develop ' 'sans argument : base develop (pas de remote)'

new_repo develop-distant develop
git update-ref refs/remotes/origin/develop develop
expect 1 'HEAD comparé à origin/develop ' 'sans argument : origin/develop prime sur develop'

new_repo sans-develop integration/ancienne
expect 2 'base « origin/develop ou develop » introuvable' 'sans develop : base introuvable, code 2'

printf '\n%s réussi(s), %s échoué(s)\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
