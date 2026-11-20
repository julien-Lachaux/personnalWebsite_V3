#!/usr/bin/env bash
# L14-02, décision de Julien du 20 nov. 2026 : la ligne Justification-test du commit qui ajoute une
# directive « Stryker disable » cite l'identifiant de chaque équivalent que la directive utilise.
# Une justification qui cite un autre identifiant, un identifiant voisin (API-EQ-10 pour API-EQ-1),
# ou qui ne le cite que hors de la ligne Justification-test, ne vaut pas. Ferme le trou constaté en
# recette du lot 12 : un commit justifié pour une directive n'en couvre pas une autre. Même harnais
# que stryker-directive-line.test.sh. Lancé par `pnpm integrity:test`.
#
# Les directives sont construites à l'exécution : ce fichier n'en contient aucune littéralement.

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/check-tests-integrity.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrite-citation-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

SD="$(printf '%s' Stryk)er $(printf '%s' dis)able"
# Équivalents déclarés : ligne 2 (StringLiteral) et ligne 4 (BooleanLiteral) de src/app.ts, et deux
# identifiants voisins (API-EQ-1, API-EQ-10) pour la ligne 2.
EQUIVALENTS='{ "equivalents": [
  { "id": "API-EQ-01", "file": "src/app.ts", "line": 2, "mutator": "StringLiteral" },
  { "id": "API-EQ-02", "file": "src/app.ts", "line": 4, "mutator": "BooleanLiteral" },
  { "id": "API-EQ-1", "file": "src/app.ts", "line": 2, "mutator": "StringLiteral" },
  { "id": "API-EQ-10", "file": "src/app.ts", "line": 2, "mutator": "StringLiteral" }
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

app() {
  printf '%s\n' "$@" >apps/api/src/app.ts
}

justified() {
  printf 'chore(mutation): équivalent\n\n%s' "$1"
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

new_repo cite
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 API-EQ-01 mutant équivalent vérifié')"
expect 0 "justification qui cite l'identifiant"

new_repo cite-en-identifiant
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: API-EQ-01 mutant équivalent vérifié')"
expect 0 "identifiant de l'équivalent en identifiant de la justification"

new_repo cite-deuxieme-ligne
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified "$(printf 'Justification-test: MUT-9 mutant équivalent vérifié\nJustification-test: MUT-9 API-EQ-01, même vérification')")"
expect 0 'identifiant cité par une seconde ligne Justification-test'

new_repo non-cite
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 mutant équivalent vérifié')"
expect 1 "justification qui ne cite pas l'identifiant" 'ne cite pas API-EQ-01'

new_repo hors-ligne
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified "$(printf 'Équivalent API-EQ-01 vérifié.\n\nJustification-test: MUT-9 mutant équivalent vérifié')")"
expect 1 'identifiant cité dans le message, hors de la ligne Justification-test' 'ne cite pas API-EQ-01'

new_repo autre-identifiant
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 API-EQ-02 mutant équivalent vérifié')"
expect 1 'justification qui cite un autre identifiant' 'ne cite pas API-EQ-01'

new_repo voisin-long
app "// $SD next-line StringLiteral: API-EQ-1 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 API-EQ-10 mutant équivalent vérifié')"
expect 1 'API-EQ-10 cité pour une directive API-EQ-1' 'ne cite pas API-EQ-1 '

new_repo voisin-prefixe
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 XAPI-EQ-01 mutant équivalent vérifié')"
expect 1 'identifiant inclus dans un mot plus long' 'ne cite pas API-EQ-01'

new_repo voisin-court
app "// $SD next-line StringLiteral: API-EQ-10 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 API-EQ-1, API-EQ-01 mutants équivalents vérifiés')"
expect 1 'API-EQ-1 cité pour une directive API-EQ-10' 'ne cite pas API-EQ-10'

new_repo ponctuation
app "// $SD next-line StringLiteral: API-EQ-1 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 équivalents (API-EQ-1), vérifiés')"
expect 0 'identifiant cité entre parenthèses'

new_repo deux-un-cite
app "// $SD StringLiteral,BooleanLiteral: API-EQ-01 et API-EQ-02" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 API-EQ-01 mutant équivalent vérifié')"
expect 1 "directive à deux équivalents, un seul cité" 'ne cite pas API-EQ-02'

new_repo deux-cites
app "// $SD StringLiteral,BooleanLiteral: API-EQ-01 et API-EQ-02" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 API-EQ-01 et API-EQ-02 mutants équivalents vérifiés')"
expect 0 'directive à deux équivalents, tous deux cités'

new_repo glissee-justifiee
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "export const b = 1;" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 API-EQ-01 mutant équivalent vérifié')"
app "// $SD next-line StringLiteral: API-EQ-01 raison" "export const a = 'x';" "// $SD next-line BooleanLiteral: API-EQ-02 raison" "export const c = true;"
commit "$(justified 'Justification-test: MUT-9 API-EQ-01 retouche du commentaire')"
expect 1 "directive glissée par un commit justifié pour un autre équivalent" 'ne cite pas API-EQ-02'

printf '\n%s réussi(s), %s échoué(s)\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
