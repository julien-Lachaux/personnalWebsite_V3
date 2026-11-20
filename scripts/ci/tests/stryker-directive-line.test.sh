#!/usr/bin/env bash
# L14-02 (décision de Julien du 19 nov. 2026, recette du lot 12) : le contrôle Justification-test
# des directives « Stryker disable » de scripts/ci/check-tests-integrity.sh passe du fichier à la
# ligne. Le commit qui ajoute une directive porte lui-même une ligne Justification-test (une
# directive glissée dans un fichier qu'un commit justifié touche déjà est refusée : trou constaté
# en recette), et chaque équivalent déclaré qu'elle cite désigne la ligne et le mutateur qu'elle
# retire du score. Même harnais que stryker-disable.test.sh. Lancé par `pnpm integrity:test`.
#
# Les directives sont construites à l'exécution : ce fichier n'en contient aucune littéralement.

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/check-tests-integrity.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrite-directive-ligne-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

SD="$(printf '%s' Stryk)er $(printf '%s' dis)able"
SR="$(printf '%s' Stryk)er $(printf '%s' rest)ore"
JUSTIFIED="$(printf 'chore(mutation): équivalent\n\nJustification-test: MUT-9 mutant équivalent vérifié')"
# Deux équivalents déclarés : ligne 2 (StringLiteral) et ligne 4 (BooleanLiteral) de src/app.ts.
EQUIVALENTS='{ "equivalents": [
  { "id": "API-EQ-01", "file": "src/app.ts", "line": 2, "mutator": "StringLiteral" },
  { "id": "API-EQ-02", "file": "src/app.ts", "line": 4, "mutator": "BooleanLiteral" }
] }'

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
  printf "export const mode = 'false';\nexport const a = 'x';\nexport const b = 1;\nexport const c = true;\n" >apps/api/src/app.ts
  printf '%s\n' "$EQUIVALENTS" >apps/api/stryker.equivalents.json
  git add -A
  git commit -q -m 'base'
  git checkout -q -b lot/essai
}

commit() {
  git add -A
  git commit -q -m "$1"
}

# Fichier app.ts : ligne 1 = première directive (ou code), puis le code de la base.
app() {
  printf '%s\n' "$@" >apps/api/src/app.ts
}

expect() {
  local expected="$1" name="$2" pattern="${3:-}" code=0
  bash "$SCRIPT" develop >"$WORK/out.txt" 2>&1 || code=$?
  if [ "$code" -eq "$expected" ] && { [ -z "$pattern" ] || grep -q -- "$pattern" "$WORK/out.txt"; }; then
    passed=$((passed + 1))
    printf 'ok      %s\n' "$name"
  else
    failed=$((failed + 1))
    printf 'ÉCHEC   %s (code %s, attendu %s%s)\n' "$name" "$code" "$expected" "${pattern:+, message « $pattern »}"
    sed 's/^/        /' "$WORK/out.txt"
  fi
}

new_repo juste
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$JUSTIFIED"
expect 0 'directive justifiée, ligne et mutateur déclarés'

new_repo glissee
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$JUSTIFIED"
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "// $SD next-line BooleanLiteral: API-EQ-02 raison" "export const c = true;"
commit 'refactor: commentaire'
expect 1 'directive glissée par un commit non justifié dans un fichier déjà justifié' 'ajoutée par un commit sans Justification-test'

new_repo non-commitee
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$JUSTIFIED"
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "// $SD next-line BooleanLiteral: API-EQ-02 raison" "export const c = true;"
expect 1 'directive pas encore commitée dans un fichier déjà justifié' 'non commitée : apps/api/src/app.ts:3'

new_repo autre-ligne
app "// $SD next-line StringLiteral: API-EQ-02 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$JUSTIFIED"
expect 1 "équivalent déclaré pour une autre ligne" 'API-EQ-02 ne désigne pas'

new_repo autre-mutateur
app "// $SD next-line BooleanLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$JUSTIFIED"
expect 1 'équivalent déclaré pour un autre mutateur' 'API-EQ-01 ne désigne pas'

new_repo tous-mutateurs
app "// $SD next-line all: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$JUSTIFIED"
expect 0 'directive « all » sur la ligne déclarée'

new_repo plusieurs
app "// $SD next-line StringLiteral,BooleanLiteral: API-EQ-01 et API-EQ-02" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$JUSTIFIED"
expect 1 "deux équivalents dont l'un vise une autre ligne" 'API-EQ-02 ne désigne pas'

new_repo plage
app "// $SD StringLiteral,BooleanLiteral: API-EQ-01 et API-EQ-02" "export const a = 'x';" "export const b = 1;" "export const c = true;" "// $SR all"
commit "$JUSTIFIED"
expect 0 'plage jusqu’au rétablissement qui couvre les deux lignes déclarées'

new_repo plage-courte
app "// $SD StringLiteral,BooleanLiteral: API-EQ-01 et API-EQ-02" "export const a = 'x';" "// $SR all" "export const c = true;"
commit "$JUSTIFIED"
expect 1 'plage refermée avant la ligne déclarée' 'API-EQ-02 ne désigne pas'

new_repo autre-fichier
mkdir -p apps/api/src/autre
printf '%s\n' "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" >apps/api/src/autre/x.ts
commit "$JUSTIFIED"
expect 1 'équivalent déclaré pour un autre fichier' 'API-EQ-01 ne désigne pas'

new_repo bloc
app "/* $SD next-line StringLiteral: API-EQ-01 */" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$JUSTIFIED"
expect 0 'directive en commentaire bloc sur la ligne déclarée'

new_repo equivalents-illisibles
printf '{ "equivalents": [ { "id": "API-EQ-01", ' >apps/api/stryker.equivalents.json
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$JUSTIFIED"
expect 1 "fichier d'équivalents illisible : refusé plutôt que lu de travers" 'contrôle des directives Stryker disable impossible'

printf '\n%s réussi(s), %s échoué(s)\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
