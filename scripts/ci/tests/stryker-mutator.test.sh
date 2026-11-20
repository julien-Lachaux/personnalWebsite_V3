#!/usr/bin/env bash
# L14-02, décision de Julien du 20 nov. 2026 : l'équivalent qu'une directive « Stryker disable »
# cite déclare son mutateur (champ « mutator » de stryker.equivalents.json), contrôlé contre la
# directive ; sans lui, l'équivalent ne justifie rien, même sur la bonne ligne ou pour une directive
# « all ». Puis les directives réelles du dépôt, avec ses fichiers d'équivalents réels, restent
# conformes à la règle. Même harnais que stryker-directive-line.test.sh. Lancé par
# `pnpm integrity:test`.
#
# Les directives sont construites à l'exécution : ce fichier n'en contient aucune littéralement.

set -euo pipefail

CI="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$CI/check-tests-integrity.sh"
ROOT="$(cd "$CI/../.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrite-mutateur-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

SD="$(printf '%s' Stryk)er $(printf '%s' dis)able"
JUSTIFIED="$(printf 'chore(mutation): équivalent\n\nJustification-test: MUT-9 API-EQ-01 mutant équivalent vérifié')"

passed=0
failed=0

new_repo() {
  local repo="$WORK/$1"
  mkdir -p "$repo/apps/api/src"
  cd "$repo"
  git init -q -b develop
  git config user.name 'Test'
  git config user.email 'ci@noreply.invalid'
  git config commit.gpgsign false
  printf "export const a = 'x';\n" >apps/api/src/app.ts
  printf '%s\n' "$2" >apps/api/stryker.equivalents.json
  git add -A
  git commit -q -m 'base'
  git checkout -q -b lot/essai
}

commit() {
  git add -A
  git commit -q -m "$1"
}

record() {
  local ok="$1" name="$2" file="$3"
  if [ "$ok" = yes ]; then
    passed=$((passed + 1))
    printf 'ok      %s\n' "$name"
  else
    failed=$((failed + 1))
    printf 'ÉCHEC   %s\n' "$name"
    sed 's/^/        /' "$file"
  fi
}

expect() {
  local expected="$1" name="$2" pattern="${3:-}" code=0
  bash "$SCRIPT" develop >"$WORK/out.txt" 2>&1 || code=$?
  if [ "$code" -eq "$expected" ] && { [ -z "$pattern" ] || grep -q -- "$pattern" "$WORK/out.txt"; }; then
    record yes "$name" "$WORK/out.txt"
  else
    printf 'code %s, attendu %s%s\n' "$code" "$expected" "${pattern:+, message « $pattern »}" >>"$WORK/out.txt"
    record no "$name" "$WORK/out.txt"
  fi
}

app() {
  printf '%s\n' "$@" >apps/api/src/app.ts
}

new_repo sans-mutateur '{ "equivalents": [{ "id": "API-EQ-01", "file": "src/app.ts", "line": 2 }] }'
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';"
commit "$JUSTIFIED"
expect 1 'équivalent sans mutateur sur la ligne de la directive' 'API-EQ-01 ne déclare pas son mutateur'

new_repo sans-mutateur-all '{ "equivalents": [{ "id": "API-EQ-01", "file": "src/app.ts", "line": 2 }] }'
app "// $SD next-line all: API-EQ-01 raison" "export const a = 'x';"
commit "$JUSTIFIED"
expect 1 'équivalent sans mutateur, directive « all »' 'API-EQ-01 ne déclare pas son mutateur'

new_repo sans-mutateur-plage '{ "equivalents": [{ "id": "API-EQ-01", "file": "src/app.ts", "line": 2 }] }'
app "// $SD StringLiteral: API-EQ-01 raison" "export const a = 'x';"
commit "$JUSTIFIED"
expect 1 'équivalent sans mutateur, directive de plage' 'API-EQ-01 ne déclare pas son mutateur'

new_repo mutateur-null '{ "equivalents": [{ "id": "API-EQ-01", "file": "src/app.ts", "line": 2, "mutator": null }] }'
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';"
commit "$JUSTIFIED"
expect 1 'mutateur déclaré nul' 'API-EQ-01 ne déclare pas son mutateur'

new_repo mutateur-nombre '{ "equivalents": [{ "id": "API-EQ-01", "file": "src/app.ts", "line": 2, "mutator": 1 }] }'
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';"
commit "$JUSTIFIED"
expect 1 'mutateur déclaré qui n’est pas un nom' 'API-EQ-01 ne déclare pas son mutateur'

new_repo deux-declarations '{ "equivalents": [
  { "id": "API-EQ-01", "file": "src/app.ts", "line": 2 },
  { "id": "API-EQ-01", "file": "src/app.ts", "line": 9, "mutator": "StringLiteral" }
] }'
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';"
commit "$JUSTIFIED"
expect 1 'une déclaration sans mutateur sur la ligne, une autre avec mutateur ailleurs' 'API-EQ-01 ne désigne pas'

new_repo avec-mutateur '{ "equivalents": [{ "id": "API-EQ-01", "file": "src/app.ts", "line": 2, "mutator": "StringLiteral" }] }'
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';"
commit "$JUSTIFIED"
expect 0 'équivalent qui déclare le mutateur de la directive'

new_repo avec-mutateur-all '{ "equivalents": [{ "id": "API-EQ-01", "file": "src/app.ts", "line": 2, "mutator": "StringLiteral" }] }'
app "// $SD next-line all: API-EQ-01 raison" "export const a = 'x';"
commit "$JUSTIFIED"
expect 0 'équivalent qui déclare son mutateur, directive « all »'

# Directives et équivalents réels du dépôt : chaque directive suivie, contrôlée comme une directive
# ajoutée, désigne une ligne et un mutateur déclarés.
cd "$ROOT"
pattern="(//|/\\*|^[[:space:]]*\\*)[[:space:]]*$(printf '%s' Stryk)er[[:space:]]+$(printf '%s' dis)able"
git grep -nIE "$pattern" -- '*.ts' '*.tsx' '*.mts' '*.cts' '*.js' '*.jsx' '*.mjs' '*.cjs' |
  awk -F: '{ print $1 "\t" $2 }' >"$WORK/reelles.txt" || true
equivalents=()
while IFS= read -r -d '' f; do equivalents+=("$f"); done < <(git ls-files -z -- '*stryker.equivalents.json')
code=0
node "$CI/stryker-directives.mjs" "${equivalents[@]}" <"$WORK/reelles.txt" >"$WORK/out.txt" 2>&1 || code=$?
if [ "$code" -eq 0 ] && [ ! -s "$WORK/out.txt" ] && [ -s "$WORK/reelles.txt" ]; then
  record yes "directives réelles du dépôt ($(wc -l <"$WORK/reelles.txt") ; ${#equivalents[@]} fichiers d'équivalents) conformes" "$WORK/out.txt"
else
  printf 'code %s ; directives lues :\n' "$code" >>"$WORK/out.txt"
  cat "$WORK/reelles.txt" >>"$WORK/out.txt"
  record no 'directives réelles du dépôt conformes' "$WORK/out.txt"
fi

printf '\n%s réussi(s), %s échoué(s)\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
