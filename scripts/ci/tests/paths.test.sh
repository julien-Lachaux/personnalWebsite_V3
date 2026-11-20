#!/usr/bin/env bash
# BF-8 (brief back-002, 20 nov. 2026) : chemins non ASCII dans scripts/ci/check-tests-integrity.sh.
# Avec core.quotePath (défaut de git), `git diff` cite les chemins accentués
# ("apps/web/test/cass\303\251.e2e.ts") : le chemin cité ne correspondait plus aux motifs des tests
# et des configurations, et `git log -- <chemin cité>` ne retrouvait pas la Justification-test.
# Avec eux, les autres chemins que le script lisait de travers : nom qui contient un caractère de
# glob (justification d'un autre fichier prise pour la sienne), ligne ajoutée qui commence par « ++ »
# (prise pour un en-tête de diff), tabulation dans un nom (refusée). Même harnais que check-tests-integrity.test.sh. Lancé par `pnpm integrity:test` et par la CI.
#
# Les marqueurs sont construits à l'exécution : ce fichier n'en contient aucun littéralement.

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/check-tests-integrity.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrite-non-ascii-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

FAILS_MARKER="it.$(printf '%s' fa)ils('BUG-8 attendu', () => {});"
SKIP_MARKER="it.$(printf '%s' sk)ip('saute', () => {});"
ACCENTED_TEST='apps/web/test/cassé.e2e.ts'
ACCENTED_SPEC='apps/api/test/échec attendu.e2e-spec.ts'
ACCENTED_CONFIG='scripts/ci/vérifie.sh'
JUSTIFIED="$(printf 'test: corrige\n\nJustification-test: F8-2 parcours établi faux par le triage')"

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
  mkdir -p apps/web/test apps/api/test scripts/ci
  printf "test('fumée', async () => {});\n" >"$ACCENTED_TEST"
  printf 'export const answer = 42;\n' >apps/web/app.ts
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

# Le rapport cite le chemin en clair, pas sous sa forme échappée.
expect_output() {
  local pattern="$1" name="$2"
  if grep -qF -- "$pattern" "$WORK/out.txt"; then
    passed=$((passed + 1))
    printf 'ok      %s\n' "$name"
  else
    failed=$((failed + 1))
    printf 'ÉCHEC   %s (motif absent : %s)\n' "$name" "$pattern"
    sed 's/^/        /' "$WORK/out.txt"
  fi
}

new_repo test-accentue-justifie
printf "test('fumée', async () => { /* corrigé */ });\n" >"$ACCENTED_TEST"
commit "$JUSTIFIED"
expect 0 'test au nom accentué modifié avec justification'

new_repo test-accentue-non-justifie
printf "test('fumée', async () => { /* vidé */ });\n" >"$ACCENTED_TEST"
commit 'test: assouplit'
expect 1 'test au nom accentué modifié sans justification'
expect_output "$ACCENTED_TEST" 'chemin accentué cité en clair'

new_repo test-accentue-supprime
git rm -q "$ACCENTED_TEST"
commit 'test: retire'
expect 1 'test au nom accentué supprimé sans justification'

new_repo echec-attendu-justifie
printf '%s\n' "$FAILS_MARKER" >"$ACCENTED_SPEC"
commit "$(printf 'test: défaut connu\n\nJustification-test: BUG-8 défaut établi, correction au lot suivant')"
expect 0 'échec attendu justifié dans un fichier au nom accentué (avec espace)'

new_repo echec-attendu-non-justifie
printf '%s\n' "$FAILS_MARKER" >"$ACCENTED_SPEC"
commit 'test: défaut connu'
expect 1 'échec attendu sans justification dans un fichier au nom accentué'

new_repo marqueur-accentue
printf '%s\n' "$SKIP_MARKER" >apps/web/test/sauté.e2e.ts
commit "$JUSTIFIED"
expect 1 'marqueur interdit dans un fichier au nom accentué, même justifié'
expect_output 'apps/web/test/sauté.e2e.ts' 'fichier du marqueur cité en clair'

new_repo configuration-accentuee
printf '#!/usr/bin/env bash\nexit 0\n' >"$ACCENTED_CONFIG"
commit 'chore(ci): nouvelle vérification'
expect 1 'configuration protégée au nom accentué créée sans justification'

new_repo configuration-accentuee-justifiee
printf '#!/usr/bin/env bash\nexit 0\n' >"$ACCENTED_CONFIG"
commit "$(printf 'chore(ci): nouvelle vérification\n\nJustification-test: L16-1 vérification ajoutée')"
expect 0 'configuration protégée au nom accentué créée avec justification'

# Un nom qui contient un caractère de glob ne vise que lui-même dans la recherche de justification.
new_repo nom-glob
printf "test('a', async () => {});\n" >apps/web/test/a.e2e.ts
printf "test('ab', async () => {});\n" >'apps/web/test/[ab].e2e.ts'
git add -A
git commit -q -m 'base des deux parcours'
git branch -f develop HEAD
printf "test('a', async () => { /* corrigé */ });\n" >apps/web/test/a.e2e.ts
commit "$JUSTIFIED"
printf "test('ab', async () => { /* vidé */ });\n" >'apps/web/test/[ab].e2e.ts'
commit 'test: assouplit'
expect 1 'justification d’un autre fichier non prise pour celle d’un nom à caractère de glob'

# Une ligne ajoutée qui commence par « ++ » n'est pas un en-tête de diff : l'échec attendu qui la
# suit reste attribué à son fichier, sans justification.
new_repo ligne-plus-plus
printf '%s\n' "$FAILS_MARKER" >apps/web/test/justifie.e2e.ts
commit "$JUSTIFIED"
printf '%s\n' "const s = \`" '++ apps/web/test/justifie.e2e.ts' "\`;" "$FAILS_MARKER" >apps/api/test/bug.e2e-spec.ts
commit 'test: défaut connu'
expect 1 'ligne « ++ » ajoutée sans effet sur l’attribution du fichier'

new_repo nom-tabulation
printf 'x\n' >"$(printf 'apps/web/a\tb.ts')"
commit 'chore: fichier'
expect 1 'chemin avec tabulation refusé'

printf '\n%s réussi(s), %s échec(s)\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
