#!/usr/bin/env bash
# Tests de scripts/ci/check-tests-integrity.sh pour les directives « Stryker disable » (lot 12,
# MUT-2) : une directive retire des mutants du score de mutation ; elle exige une ligne
# Justification-test dans un commit qui touche le fichier et doit citer l'identifiant d'un mutant
# équivalent déclaré dans un stryker.equivalents.json. Chaque cas crée un dépôt git temporaire avec
# une branche d'intégration « v3/backend », dérive une branche et vérifie le code de sortie.
# Lancé par `pnpm integrity:test` (donc par pnpm check) et par la CI.
#
# Les directives sont construites à l'exécution : ce fichier n'en contient aucune littéralement.

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/check-tests-integrity.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrite-stryker-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

DIRECTIVE="// $(printf '%s' Stryk)er $(printf '%s' dis)able next-line StringLiteral"
EQUIVALENTS='{ "equivalents": [{ "id": "API-EQ-01", "file": "src/app.ts", "line": 2 }] }'
JUSTIFIED="$(printf 'chore(mutation): équivalent\n\nJustification-test: MUT-9 mutant équivalent vérifié')"

passed=0
failed=0

new_repo() {
  local repo="$WORK/$1"
  mkdir -p "$repo/apps/api/src"
  cd "$repo"
  git init -q -b v3/backend
  git config user.name 'Test'
  git config user.email 'ci@noreply.invalid'
  git config commit.gpgsign false
  printf "export const mode = 'false';\n" >apps/api/src/app.ts
  git add -A
  git commit -q -m 'base'
  git checkout -q -b lot/essai
}

commit() {
  git add -A
  git commit -q -m "$1"
}

expect() {
  local expected="$1" name="$2" pattern="${3:-}" code=0
  bash "$SCRIPT" v3/backend >"$WORK/out.txt" 2>&1 || code=$?
  if [ "$code" -eq "$expected" ] && { [ -z "$pattern" ] || grep -q -- "$pattern" "$WORK/out.txt"; }; then
    passed=$((passed + 1))
    printf 'ok      %s\n' "$name"
  else
    failed=$((failed + 1))
    printf 'ÉCHEC   %s (code %s, attendu %s%s)\n' "$name" "$code" "$expected" "${pattern:+, message « $pattern »}"
    sed 's/^/        /' "$WORK/out.txt"
  fi
}

new_repo sans-justification
printf '%s\n' "$EQUIVALENTS" >apps/api/stryker.equivalents.json
commit "$JUSTIFIED"
printf "%s: API-EQ-01 raison\nexport const mode = 'false';\n" "$DIRECTIVE" >apps/api/src/app.ts
commit 'refactor: commentaire'
expect 1 'directive ajoutée sans Justification-test' 'ajoutée sans Justification-test : apps/api/src/app.ts'

new_repo declaree
printf '%s\n' "$EQUIVALENTS" >apps/api/stryker.equivalents.json
printf "%s: API-EQ-01 raison\nexport const mode = 'false';\n" "$DIRECTIVE" >apps/api/src/app.ts
commit "$JUSTIFIED"
expect 0 'directive justifiée qui cite un équivalent déclaré'

new_repo sans-identifiant
printf "%s: équivalent, croyez-moi\nexport const mode = 'false';\n" "$DIRECTIVE" >apps/api/src/app.ts
commit "$JUSTIFIED"
expect 1 "directive justifiée sans identifiant d'équivalent" 'sans identifiant de mutant équivalent'

new_repo non-declaree
printf '%s\n' "$EQUIVALENTS" >apps/api/stryker.equivalents.json
printf "%s: API-EQ-02 raison\nexport const mode = 'false';\n" "$DIRECTIVE" >apps/api/src/app.ts
commit "$JUSTIFIED"
expect 1 'directive justifiée qui cite un équivalent non déclaré' 'non déclaré (API-EQ-02)'

new_repo non-suivie
printf '%s\n' "$EQUIVALENTS" >apps/api/stryker.equivalents.json
commit "$JUSTIFIED"
printf "%s: API-EQ-01 raison\nexport const x = '';\n" "$DIRECTIVE" >apps/api/src/brouillon.ts
expect 1 'directive dans un fichier non suivi' 'ajoutée sans Justification-test : apps/api/src/brouillon.ts'

new_repo bloc
printf '%s\n' "$EQUIVALENTS" >apps/api/stryker.equivalents.json
commit "$JUSTIFIED"
printf "/* %s %s all */\nexport const mode = 'false';\n" "$(printf '%s' Stryk)er" "$(printf '%s' dis)able" >apps/api/src/app.ts
commit 'refactor: commentaire bloc'
expect 1 'directive en commentaire bloc, sans justification ni identifiant'

new_repo prose
printf 'Une directive %s se justifie (API-EQ-07).\n' "${DIRECTIVE#// }" >NOTES.md
commit 'docs: notes'
expect 0 'directive citée en prose hors code'

new_repo heritee
printf "%s: API-EQ-09 raison\nexport const mode = 'false';\n" "$DIRECTIVE" >apps/api/src/app.ts
git checkout -q v3/backend
git add -A
git commit -q -m "$JUSTIFIED"
git checkout -q -b lot/suivant
expect 1 "directive déjà sur la branche d'intégration, équivalent jamais déclaré" 'non déclaré (API-EQ-09)'

printf '\n%s réussi(s), %s échoué(s)\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
